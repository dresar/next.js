import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";

export type Measurement = {
  id: string;
  created_at: string;
  user_id: string | null;
  owner_name: string;
  ph_value: number | null;
  tds_value: number;
  temperature: number;
  quality_status: string;
  latitude: number | null;
  longitude: number | null;
  voltage_probe: number | null;
  battery_level: number | null;
  device_id: string | null;
  device_status: string | null;
  probe_status: string | null;
  firmware_version: string | null;
  source: string;
};

function normalizeMeasurement(m: Record<string, unknown>): Measurement {
  const toNum = (v: unknown) => (v != null ? Number(v) : null);
  const toStr = (v: unknown) => (v != null ? String(v) : null);
  return {
    id: String(m.id),
    created_at: String(m.created_at),
    user_id: toStr(m.user_id),
    owner_name: String(m.owner_name ?? "Unknown"),
    ph_value: toNum(m.ph_value),
    tds_value: Number(m.tds_value) || 0,
    temperature: Number(m.temperature) || 0,
    quality_status: String(m.quality_status ?? "Mutu Prima"),
    latitude: toNum(m.latitude),
    longitude: toNum(m.longitude),
    voltage_probe: toNum(m.voltage_probe),
    battery_level: toNum(m.battery_level),
    device_id: toStr(m.device_id),
    device_status: toStr(m.device_status),
    probe_status: toStr(m.probe_status),
    firmware_version: toStr(m.firmware_version),
    source: String(m.source ?? "manual"),
  };
}

export function useMeasurements() {
  const [data, setData] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const rows = await apiFetch<Record<string, unknown>[]>("/api/measurements");
      setData(rows.map(normalizeMeasurement));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "measurement:new") {
        const raw = evt.data as Record<string, unknown>;
        const m = normalizeMeasurement(raw);
        setData((prev) => {
          const next = [m, ...prev.filter((x) => x.id !== m.id)];
          return next.slice(0, 500);
        });
      }
    });
    return () => unsub();
  }, []);

  return { data, loading, refetch: fetchData };
}

export function useInsertMeasurement() {
  const insert = async (params: {
    ownerName: string;
    ph: number;
    tds: number;
    temperature: number;
    latitude?: number;
    longitude?: number;
  }) => {
    try {
      await apiFetch("/api/measurements", {
        method: "POST",
        body: JSON.stringify({
          ownerName: params.ownerName,
          ph: params.ph,
          tds: params.tds,
          temperature: params.temperature,
          latitude: params.latitude ?? null,
          longitude: params.longitude ?? null,
          deviceStatus: null,
        }),
      });
      return { error: null as null | { message: string } };
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal menyimpan data";
      return { error: { message } };
    }
  };

  return { insert };
}
