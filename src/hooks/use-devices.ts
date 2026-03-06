import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { subscribeRealtime } from "@/lib/realtime";

export type Device = {
  id: string;
  wifi_connected: boolean | null;
  mqtt_connected: boolean | null;
  battery_level: number | null;
  firmware_version: string | null;
  last_seen: string | null;
  last_data_at: string | null;
  last_status_at: string | null;
  last_status: string | null;
};

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [offlineAfterSeconds, setOfflineAfterSeconds] = useState(60);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<{ device_id: string; status: string; at: string }[]>([]);

  const fetchDevices = async () => {
    const res = await apiFetch<{ offline_after_seconds: number; devices: Device[] }>("/api/devices");
    setDevices(res.devices);
    setOfflineAfterSeconds(res.offline_after_seconds);
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices().catch(() => setLoading(false));
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "device:status") {
        const d = evt.data as any;
        setDevices((prev) => {
          const next = prev.map((x) => (x.id === d.device_id ? {
            ...x,
            wifi_connected: d.wifi_connected ?? x.wifi_connected,
            mqtt_connected: d.mqtt_connected ?? x.mqtt_connected,
            battery_level: d.battery_level ?? x.battery_level,
            firmware_version: d.firmware_version ?? x.firmware_version,
            last_seen: d.at ?? x.last_seen,
            last_status_at: d.at ?? x.last_status_at,
            last_status: d.status ?? x.last_status,
          } : x));
          if (next.some((x) => x.id === d.device_id)) return next;
          return [{ id: d.device_id, wifi_connected: d.wifi_connected ?? null, mqtt_connected: d.mqtt_connected ?? null, battery_level: d.battery_level ?? null, firmware_version: d.firmware_version ?? null, last_seen: d.at ?? null, last_data_at: null, last_status_at: d.at ?? null, last_status: d.status ?? null }, ...prev];
        });
      }
      if (evt.type === "device:warning") {
        const w = evt.data as any;
        setWarnings((prev) => [{ device_id: w.device_id, status: w.status, at: w.at }, ...prev].slice(0, 50));
      }
    });
    return () => unsub();
  }, []);

  const deviceStatus = useMemo(() => {
    const now = Date.now();
    return devices.map((d) => {
      const last = d.last_seen ? new Date(d.last_seen).getTime() : 0;
      const online = last > 0 && (now - last) / 1000 <= offlineAfterSeconds;
      return { ...d, online };
    });
  }, [devices, offlineAfterSeconds]);

  return { devices: deviceStatus, warnings, loading, offlineAfterSeconds, refetch: fetchDevices };
}

