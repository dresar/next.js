import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
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
export async function prefetchMeasurements() {
  await queryClient.prefetchQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const rows = await apiFetch<Record<string, unknown>[]>("/api/measurements");
      return rows.map(normalizeMeasurement);
    },
  });
}

export function useMeasurements() {
  const { data = [], isLoading: loading, refetch } = useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const rows = await apiFetch<Record<string, unknown>[]>("/api/measurements");
      return rows.map(normalizeMeasurement);
    },
  });

  useEffect(() => {
    // Inject realtime data ke dalam Cache React Query
    const unsub = subscribeRealtime((evt) => {
      // Kita pakai "measurement:new" atau "measurement:realtime"
      // Di arsitektur Serverless Vercel, "measurement:new" tak jalan dr WS, tapi kita pakai manual cache mutasi.
      // Bagaimanapun, kita biarkan saja ini buat safety jika sewaktu-waktu ESP32 dipantau 1 arah.
      if (evt.type === "measurement:realtime" || evt.type === "measurement:new") {
        const raw = evt.data as Record<string, unknown>;
        const m = normalizeMeasurement(raw);
        
        queryClient.setQueryData<Measurement[]>(["measurements"], (prev) => {
          if (!prev) return [m];
          // Hindari duplikat ID/timestamp (MQTT bisa kirim beruntun berulang)
          if (m.id !== "undefined" && prev.find((x) => x.id === m.id)) return prev;
          
          const next = [m, ...prev.filter(x => x.id !== m.id)];
          return next.slice(0, 500); // Batasi 500 biar tidak berat
        });
      }
    });
    return () => unsub();
  }, []);

  return { data, loading, refetch };
}

export function useInsertMeasurement() {
  const mutation = useMutation({
    mutationFn: async (params: {
      ownerName: string;
      ph: number | null;
      tds: number;
      temperature: number;
      quality_status: string;
      probe_status: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }) => {
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
          quality_status: params.quality_status, // Ensure custom UI sets logic passes backend
        }),
      });
      return params;
    },
    onSuccess: (params) => {
      // Sengaja Fetch ulang latar belakang untuk kepastian DB (meski lambat di Vercel),
      // ATAU Injeksi Manual di Popup MQTT.
      // Untuk pastinya kita invalidate agar di background terupdate.
      queryClient.invalidateQueries({ queryKey: ["measurements"] });
    }
  });

  const insert = async (params: {
    ownerName: string;
    ph: number | null;
    tds: number;
    temperature: number;
    quality_status: string;
    probe_status: string | null;
    latitude?: number | null;
    longitude?: number | null;
  }) => {
    try {
      await mutation.mutateAsync(params);
      return { error: null as null | { message: string } };
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal menyimpan data";
      return { error: { message } };
    }
  };

  return { insert };
}
