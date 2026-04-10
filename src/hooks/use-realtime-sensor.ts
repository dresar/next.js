import { useEffect, useState } from "react";
import { subscribeRealtime } from "@/lib/realtime";

/**
 * Field yang benar-benar dikirim oleh ESP32 (Program.cs BLOK 8):
 * ph, tds, temp, mutu — ditambah derived fields dari server (quality_status, probe_status)
 */
export type RealtimeSensorData = {
  ph_value: number | null;       // pH (ESP32: "ph")
  tds_value: number;             // TDS ppm (ESP32: "tds")
  temperature: number;           // Suhu °C (ESP32: "temp")
  quality_status: string;        // Hasil mapping dari mutu ESP32
  probe_status: string | null;   // Derived: liquid_detected / probe_dry
  device_id: string | null;      // ID perangkat
  owner_name: string | null;     // Nama pemilik jika ada
  source: string;
  created_at: string;
};

/**
 * Hook untuk data sensor REALTIME langsung dari ESP32 via WebSocket.
 * Data ini BELUM disimpan ke database — hanya masuk DB saat user klik "Simpan" di modal.
 */
export function useRealtimeSensor() {
  const [sensor, setSensor] = useState<RealtimeSensorData | null>(null);

  useEffect(() => {
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "measurement:realtime") {
        setSensor(evt.data as RealtimeSensorData);
      }
    });

    // Cek keaktifan setiap 10 detik. Jika data terakhir lebih dari 60 detik, anggap mati.
    const timer = setInterval(() => {
      setSensor((current) => {
        if (!current) return null;
        const last = new Date(current.created_at).getTime();
        if (Date.now() - last > 60000) {
          return null; // Timeout: perangkat offline
        }
        return current;
      });
    }, 10000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  return sensor;
}
