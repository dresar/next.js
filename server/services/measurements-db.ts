import { pool } from "../db/pool";

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  return String(v).trim() || null;
}

/** Normalize DB row so frontend always gets consistent types (numbers, not strings) */
export function normalizeMeasurementRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    user_id: row.user_id ?? null,
    owner_name: row.owner_name ?? "Unknown",
    ph_value: toNum(row.ph_value),
    tds_value: Number(row.tds_value) || 0,
    temperature: Number(row.temperature) || 0,
    quality_status: toStr(row.quality_status) ?? "Mutu Prima",
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
    voltage_probe: toNum(row.voltage_probe),
    battery_level: toNum(row.battery_level),
    device_id: toStr(row.device_id),
    device_status: toStr(row.device_status),
    probe_status: toStr(row.probe_status),
    firmware_version: toStr(row.firmware_version),
    source: toStr(row.source) ?? "manual",
    created_at: row.created_at,
  };
}

export async function insertMeasurementFromMqtt(params: {
  owner_name: string;
  tds_value: number;
  temperature: number;
  quality_status: string;
  latitude: number | null;
  longitude: number | null;
  device_id: string;
  voltage_probe: number | null;
  battery_level: number | null;
  device_status: string | null;
  probe_status: string;
  firmware_version: string | null;
  created_at: Date;
}) {
  const r = await pool.query(
    `
    INSERT INTO public.latex_measurements
      (user_id, owner_name, ph_value, tds_value, temperature, quality_status, latitude, longitude,
       device_id, voltage_probe, battery_level, device_status, probe_status, firmware_version, source, created_at)
    VALUES (NULL, $1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'mqtt', $13)
    RETURNING id, user_id, device_id, owner_name, ph_value::float8, tds_value, temperature::float8, quality_status,
      latitude::float8, longitude::float8, voltage_probe::float8, battery_level::float8, device_status, probe_status, firmware_version, source, created_at
    `,
    [
      params.owner_name,
      params.tds_value,
      params.temperature,
      params.quality_status,
      params.latitude,
      params.longitude,
      params.device_id,
      params.voltage_probe,
      params.battery_level,
      params.device_status,
      params.probe_status,
      params.firmware_version,
      params.created_at,
    ]
  );
  return r.rows[0] as Record<string, unknown>;
}

export async function updateDeviceLastSeen(
  deviceId: string,
  receivedAt: Date,
  data: { battery_level?: number | null; firmware_version?: string | null; last_status?: string | null }
) {
  await pool.query(
    `
    INSERT INTO public.devices (id, mqtt_connected, battery_level, firmware_version, last_seen, last_data_at, last_status, last_status_at)
    VALUES ($1, true, $2, $3, $4, $4, $5, $4)
    ON CONFLICT (id) DO UPDATE SET
      mqtt_connected = true,
      battery_level = COALESCE(EXCLUDED.battery_level, public.devices.battery_level),
      firmware_version = COALESCE(EXCLUDED.firmware_version, public.devices.firmware_version),
      last_seen = EXCLUDED.last_seen,
      last_data_at = EXCLUDED.last_data_at,
      last_status = COALESCE(EXCLUDED.last_status, public.devices.last_status),
      last_status_at = EXCLUDED.last_status_at
    `,
    [deviceId, data.battery_level ?? null, data.firmware_version ?? null, receivedAt, data.last_status ?? null]
  );
}
