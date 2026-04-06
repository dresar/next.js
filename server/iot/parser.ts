import { z } from "zod";

// ESP32 payload: { temp, tds, volt, battery, status } + optional fields
const zNum = z.coerce.number();
export const iotDataSchema = z.object({
  device_id: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
  owner_name: z.string().min(1).optional(),
  ownerName: z.string().min(1).optional(),
  temperature: zNum.optional(),
  temp: zNum.optional(),
  tds: zNum,
  ph: zNum.optional(),
  mutu: z.string().optional(),
  quality_status: z.string().optional(),
  voltage: zNum.optional(),
  volt: zNum.optional(),
  battery: zNum.optional(),
  status: z.string().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  latitude: zNum.optional(),
  longitude: zNum.optional(),
  firmware_version: z.string().optional(),
  firmware: z.string().optional(),
}).transform((p) => ({
  ...p,
  temperature: p.temperature ?? p.temp ?? 0,
  voltage: p.voltage ?? p.volt,
  quality_status: p.quality_status ?? p.mutu,
}));

export const iotStatusSchema = z.object({
  device_id: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
  wifi: z.boolean().optional(),
  wifi_connected: z.boolean().optional(),
  mqtt: z.boolean().optional(),
  mqtt_connected: z.boolean().optional(),
  battery: zNum.optional(),
  voltage: zNum.optional(),
  status: z.string().optional(),
  timestamp: z.union([z.string(), z.number()]).optional(),
  firmware_version: z.string().optional(),
  firmware: z.string().optional(),
});

export function normalizeTimestamp(ts: string | number | undefined) {
  if (ts == null) return new Date();
  if (typeof ts === "number") {
    // accept seconds or ms
    return new Date(ts < 1e12 ? ts * 1000 : ts);
  }
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

export function getDeviceId(payload: { device_id?: string; deviceId?: string }, fallback = "esp32") {
  return (payload.device_id ?? payload.deviceId ?? fallback).trim();
}

