import { z } from "zod";

// ESP32 payload (topic: skripsi/eka/lateks):
// { "ph": 7.45, "tds": 352, "temp": 28.5, "mutu": "PRIMA (OK)" }
const zNum = z.coerce.number();
export const iotDataSchema = z.object({
  // Field utama ESP32
  ph:   zNum.optional(),           // Nilai pH (ADS1115 kanal A2)
  tds:  zNum,                      // Total Dissolved Solids (ADS1115 kanal A3)
  temp: zNum.optional(),           // Suhu DS18B20 (GPIO 4)
  mutu: z.string().optional(),     // Hasil klasifikasi ESP32 (Decision Tree BLOK 6)

  // Field alternatif (kompatibilitas multi-topic)
  temperature:    zNum.optional(),
  quality_status: z.string().optional(),
  device_id:      z.string().min(1).optional(),
  deviceId:       z.string().min(1).optional(),
  owner_name:     z.string().min(1).optional(),
  ownerName:      z.string().min(1).optional(),
  timestamp:      z.union([z.string(), z.number()]).optional(),
  latitude:       zNum.optional(),
  longitude:      zNum.optional(),
}).transform((p) => ({
  ...p,
  // Normalisasi: "temp" atau "temperature" → temperature
  temperature: p.temperature ?? p.temp ?? 0,
}));

export const iotStatusSchema = z.object({
  device_id:        z.string().min(1).optional(),
  deviceId:         z.string().min(1).optional(),
  wifi:             z.boolean().optional(),
  wifi_connected:   z.boolean().optional(),
  mqtt:             z.boolean().optional(),
  mqtt_connected:   z.boolean().optional(),
  status:           z.string().optional(),
  timestamp:        z.union([z.string(), z.number()]).optional(),
});

export function normalizeTimestamp(ts: string | number | undefined) {
  if (ts == null) return new Date();
  if (typeof ts === "number") {
    return new Date(ts < 1e12 ? ts * 1000 : ts);
  }
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

export function getDeviceId(
  payload: { device_id?: string; deviceId?: string },
  fallback = "esp32-lateks"
) {
  return (payload.device_id ?? payload.deviceId ?? fallback).trim();
}
