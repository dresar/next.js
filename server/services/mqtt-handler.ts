import { getDeviceId, iotDataSchema, iotStatusSchema, normalizeTimestamp } from "../iot/parser";
import { classifyLatexQuality, probeStatusFromMutu } from "../iot/classify";
import { updateDeviceLastSeen } from "./measurements-db";
import { pool } from "../db/pool";
import { broadcastJson } from "../realtime/ws";

/**
 * Pemetaan nilai mutu dari ESP32 ke label Indonesia standar.
 * Sesuai BLOK 6 kode ESP32 (Program.cs):
 * - "PRIMA (OK)"      → Mutu Prima
 * - "BURUK (ASAM)"    → Mutu Rendah (Asam)
 * - "AWET (AMONIA)"   → Terawetkan Amonia
 * - "KONTAMINASI"     → Indikasi Kontaminasi
 * - "OPLOS AIR"       → Indikasi Oplos Air
 * - "TIDAK ADA SAMPEL"→ diabaikan (probe di udara, jangan kirim ke dashboard)
 */
function mapMutuESP32(mutu: string | undefined | null): string | null {
  const s = String(mutu ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s.includes("TIDAK ADA SAMPEL")) return null; // Guard: skip probe di udara
  if (s.includes("PRIMA"))  return "Mutu Prima";
  if (s.includes("BURUK") || s.includes("ASAM"))   return "Mutu Rendah (Asam)";
  if (s.includes("AWET")  || s.includes("AMONIA")) return "Terawetkan Amonia";
  if (s.includes("KONTAMINASI")) return "Indikasi Kontaminasi";
  if (s.includes("OPLOS"))  return "Indikasi Oplos Air";
  return null;
}

export function createMqttDataHandler(broadcast: (msg: unknown) => void = broadcastJson) {
  return async (topic: string, payload: unknown, receivedAt: Date) => {
    if (topic === "latex/iot/data" || topic === "skripsi/eka/lateks") {
      const parsed = iotDataSchema.safeParse(payload);
      if (!parsed.success) {
        console.log("[mqtt] data parse failed:", parsed.error.message);
        return;
      }
      const p = parsed.data;
      const topicOwner = topic.startsWith("skripsi/") ? topic.split("/")[1] : undefined;
      const ownerName = (p.owner_name ?? p.ownerName ?? topicOwner ?? "Unknown").toString();
      const deviceId = getDeviceId(p, `esp32-lateks`);
      const createdAt = normalizeTimestamp(p.timestamp ?? receivedAt.getTime());

      // Mutu dari ESP32 → label Indonesia
      const mappedMutu = mapMutuESP32(p.quality_status ?? p.mutu);

      // GUARD: Jika ESP32 mengirim "TIDAK ADA SAMPEL" (probe di udara) → abaikan
      if (mappedMutu === null && (p.quality_status || p.mutu)) {
        const rawMutu = String(p.quality_status ?? p.mutu ?? "").toUpperCase();
        if (rawMutu.includes("TIDAK ADA SAMPEL")) {
          console.log("[mqtt] probe di udara (TIDAK ADA SAMPEL), data diabaikan.");
          // Tetap update device last-seen tapi tidak broadcast ke frontend
          await updateDeviceLastSeen(deviceId, receivedAt, { last_status: "probe_dry" });
          return;
        }
      }

      // Fallback klasifikasi jika mutu tidak tersedia
      const qualityStatus = mappedMutu ?? classifyLatexQuality({ ph: p.ph ?? null, tds: p.tds });

      // Probe status: liquid_detected jika data valid masuk ke sini
      const probeStatus = probeStatusFromMutu(qualityStatus);

      console.log("[mqtt] data diterima (ESP32):", {
        deviceId,
        ph: p.ph,
        tds: p.tds,
        temp: p.temperature,
        mutu: qualityStatus,
        probe: probeStatus,
      });

      // Update device last-seen
      await updateDeviceLastSeen(deviceId, receivedAt, {
        battery_level: null,
        firmware_version: null,
        last_status: "liquid_detected",
      });

      // Log ke device_logs untuk debugging
      const logPayload =
        typeof payload === "object" && payload != null
          ? { ...(payload as Record<string, unknown>), device_id: deviceId, quality_status: qualityStatus }
          : { payload, device_id: deviceId, quality_status: qualityStatus };

      await pool.query(
        `INSERT INTO public.device_logs (device_id, topic, payload, received_at) VALUES ($1, $2, $3, $4)`,
        [deviceId, topic, logPayload, receivedAt]
      );

      // Broadcast ke frontend — hanya 4 field dari ESP32 + derived fields
      // TIDAK disimpan ke DB — hanya masuk DB jika user klik Simpan di modal
      broadcast({
        type: "measurement:realtime",
        data: {
          ph_value: p.ph ?? null,
          tds_value: Math.round(p.tds),
          temperature: p.temperature,
          quality_status: qualityStatus,
          probe_status: probeStatus,
          device_id: deviceId,
          owner_name: ownerName !== "Unknown" ? ownerName : null,
          source: "mqtt",
          created_at: createdAt.toISOString(),
        },
      });

      broadcast({
        type: "device:status",
        data: {
          device_id: deviceId,
          wifi_connected: null,
          mqtt_connected: true,
          battery_level: null,
          firmware_version: null,
          status: "liquid_detected",
          at: receivedAt.toISOString(),
        },
      });

    } else if (topic === "latex/iot/status") {
      const parsed = iotStatusSchema.safeParse(payload);
      if (!parsed.success) {
        console.log("[mqtt] latex/iot/status parse failed:", parsed.error.message);
        return;
      }
      const p = parsed.data;
      const deviceId = getDeviceId(p);
      const wifi = p.wifi_connected ?? p.wifi ?? null;
      const mqttConnected = p.mqtt_connected ?? p.mqtt ?? null;
      const deviceStatus = p.status ?? null;

      console.log("[mqtt] status received:", { deviceId, wifi, mqtt: mqttConnected });

      await pool.query(
        `
        INSERT INTO public.devices (id, wifi_connected, mqtt_connected, battery_level, firmware_version, last_seen, last_status_at, last_status)
        VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          wifi_connected = COALESCE(EXCLUDED.wifi_connected, public.devices.wifi_connected),
          mqtt_connected = COALESCE(EXCLUDED.mqtt_connected, public.devices.mqtt_connected),
          battery_level = COALESCE(EXCLUDED.battery_level, public.devices.battery_level),
          firmware_version = COALESCE(EXCLUDED.firmware_version, public.devices.firmware_version),
          last_seen = EXCLUDED.last_seen,
          last_status_at = EXCLUDED.last_status_at,
          last_status = COALESCE(EXCLUDED.last_status, public.devices.last_status)
        `,
        [deviceId, wifi, mqttConnected, null, null, receivedAt, deviceStatus]
      );

      await pool.query(
        `INSERT INTO public.device_logs (device_id, topic, payload, received_at) VALUES ($1, $2, $3, $4)`,
        [deviceId, topic, payload, receivedAt]
      );

      broadcast({
        type: "device:status",
        data: {
          device_id: deviceId,
          wifi_connected: wifi,
          mqtt_connected: mqttConnected,
          battery_level: null,
          firmware_version: null,
          status: deviceStatus,
          at: receivedAt.toISOString(),
        },
      });
    }
  };
}
