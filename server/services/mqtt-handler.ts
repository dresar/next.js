import { getDeviceId, iotDataSchema, iotStatusSchema, normalizeTimestamp } from "../iot/parser";
import { classifyLatexQuality, probeStatusFromDeviceStatus } from "../iot/classify";
import { insertMeasurementFromMqtt, normalizeMeasurementRow, updateDeviceLastSeen } from "./measurements-db";
import { pool } from "../db/pool";
import { broadcastJson } from "../realtime/ws";

function mapMutuToQualityStatus(mutu: string | undefined | null) {
  const s = String(mutu ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("asam")) return "Mutu Rendah Asam";
  if (s.includes("amonia")) return "Terawetkan Amonia";
  if (s.includes("oplos")) return "Indikasi Oplos Air";
  if (s.includes("kontaminasi")) return "Indikasi Kontaminasi";
  if (s.includes("prima")) return "Mutu Prima";
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
      const deviceId = getDeviceId(p, `esp32-${ownerName || "device"}`);
      const createdAt = normalizeTimestamp(p.timestamp ?? receivedAt.getTime());
      const firmwareVersion = p.firmware_version ?? p.firmware ?? null;
      const mappedQuality = mapMutuToQualityStatus(p.quality_status);
      const qualityStatus = mappedQuality ?? classifyLatexQuality({ ph: p.ph ?? null, tds: p.tds });
      const deviceStatus = p.status ?? (p.tds > 20 ? "liquid_detected" : "probe_dry");
      const probeStatus = probeStatusFromDeviceStatus(deviceStatus);

      console.log("[mqtt] data received:", { deviceId, temp: p.temperature, tds: p.tds, volt: p.voltage, battery: p.battery, status: deviceStatus, probe: probeStatus });

      if (ownerName && ownerName !== "Unknown") {
        await pool.query(
          `
          INSERT INTO public.latex_owners (name)
          VALUES ($1)
          ON CONFLICT (name) DO NOTHING
          `,
          [ownerName]
        );
      }

      const row = await insertMeasurementFromMqtt({
        owner_name: ownerName,
        ph_value: p.ph ?? null,
        tds_value: Math.round(p.tds),
        temperature: p.temperature,
        quality_status: qualityStatus,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        device_id: deviceId,
        voltage_probe: p.voltage ?? null,
        battery_level: p.battery ?? null,
        device_status: deviceStatus,
        probe_status: probeStatus,
        firmware_version: firmwareVersion,
        created_at: createdAt,
      });

      await updateDeviceLastSeen(deviceId, receivedAt, {
        battery_level: p.battery ?? null,
        firmware_version: firmwareVersion,
        last_status: deviceStatus,
      });

      const logPayload =
        typeof payload === "object" && payload != null
          ? { ...((payload as Record<string, unknown>) ?? {}), device_id: deviceId, owner_name: ownerName, status: deviceStatus, timestamp: createdAt.toISOString() }
          : { payload, device_id: deviceId, owner_name: ownerName, status: deviceStatus, timestamp: createdAt.toISOString() };

      await pool.query(
        `INSERT INTO public.device_logs (device_id, topic, payload, received_at, measurement_id) VALUES ($1, $2, $3, $4, $5)`,
        [deviceId, topic, logPayload, receivedAt, row.id]
      );

      const normalized = normalizeMeasurementRow(row);
      broadcast({ type: "measurement:new", data: normalized });
      broadcast({
        type: "device:status",
        data: {
          device_id: deviceId,
          wifi_connected: null,
          mqtt_connected: true,
          battery_level: p.battery ?? null,
          firmware_version: firmwareVersion,
          status: deviceStatus,
          at: receivedAt.toISOString(),
        },
      });
      console.log("[mqtt] measurement saved and broadcast, id:", row.id);

      if (deviceStatus && ["temp_error", "probe_dry", "sensor_disconnected"].some((x) => String(deviceStatus).toLowerCase().includes(x))) {
        broadcast({ type: "device:warning", data: { device_id: deviceId, status: deviceStatus, at: receivedAt.toISOString() } });
      }
    } else if (topic === "latex/iot/status") {
      const parsed = iotStatusSchema.safeParse(payload);
      if (!parsed.success) {
        console.log("[mqtt] latex/iot/status parse failed:", parsed.error.message);
        return;
      }
      const p = parsed.data;
      const deviceId = getDeviceId(p);
      const firmwareVersion = p.firmware_version ?? p.firmware ?? null;
      const wifi = p.wifi_connected ?? p.wifi ?? null;
      const mqttConnected = p.mqtt_connected ?? p.mqtt ?? null;
      const deviceStatus = p.status ?? null;

      console.log("[mqtt] status received:", { deviceId, wifi, mqtt: mqttConnected, battery: p.battery, status: deviceStatus });

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
        [deviceId, wifi, mqttConnected, p.battery ?? null, firmwareVersion, receivedAt, deviceStatus]
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
          battery_level: p.battery ?? null,
          firmware_version: firmwareVersion,
          status: deviceStatus,
          at: receivedAt.toISOString(),
        },
      });
    }
  };
}
