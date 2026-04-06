import { useEffect, useState } from "react";
import { subscribeRealtime } from "@/lib/realtime";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, Droplets } from "lucide-react";

type PendingMeasurement = {
  id: string;
  owner_name: string | null;
  ph_value: number | null;
  tds_value: number;
  temperature: number;
  quality_status: string;
  device_id: string | null;
  source: string | null;
  created_at: string;
};

export function MqttOwnerPopup() {
  const [pending, setPending] = useState<PendingMeasurement | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [history, setHistory] = useState<PendingMeasurement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "measurement:new") {
        const m = evt.data as PendingMeasurement;
        const isMqtt = String(m.source ?? "").toLowerCase() === "mqtt";
        if (!isMqtt) return;
        if (pending) return;
        setPending(m);
        setOwnerName((m.owner_name ?? "").trim());
      }
    });
    return () => unsub();
  }, [pending]);

  useEffect(() => {
    if (!pending?.id) return;
    apiFetch<string[]>("/api/owners")
      .then((rows) => setOwners(rows))
      .catch(() => setOwners([]));
  }, [pending?.id]);

  useEffect(() => {
    const q = ownerName.trim();
    if (!q) {
      setHistory([]);
      return;
    }
    apiFetch<Record<string, unknown>[]>(`/api/measurements?owner=${encodeURIComponent(q)}&limit=10`)
      .then((rows) => {
        const next = rows.map((r) => ({
          id: String(r.id),
          owner_name: String(r.owner_name ?? ""),
          ph_value: (r.ph_value ?? null) as number | null,
          tds_value: Number(r.tds_value) || 0,
          temperature: Number(r.temperature) || 0,
          quality_status: String(r.quality_status ?? ""),
          device_id: (r.device_id ?? null) as string | null,
          source: (r.source ?? null) as string | null,
          created_at: String(r.created_at),
        }));
        setHistory(next.slice(0, 5));
      })
      .catch(() => setHistory([]));
  }, [ownerName]);

  const handleSave = async () => {
    if (!pending || !ownerName.trim()) {
      toast.error("Masukkan nama pemilik latex");
      return;
    }
    setLoading(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, enableHighAccuracy: true })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        toast.info("Lokasi GPS tidak tersedia. Data disimpan tanpa koordinat.");
      }
      await apiFetch(`/api/measurements/${pending.id}`, {
        method: "PATCH",
        body: JSON.stringify({ owner_name: ownerName.trim(), latitude: lat, longitude: lng }),
      });
      toast.success("Data berhasil dilengkapi!");
      setPending(null);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setPending(null);
  };

  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Data Sensor Baru Diterima
          </DialogTitle>
          <DialogDescription>
            Data pH/TDS/Suhu diterima dari ESP32. Masukkan (atau konfirmasi) nama pemilik untuk menyimpan identitas dan riwayat.
          </DialogDescription>
        </DialogHeader>
        {pending && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium text-muted-foreground">Data sensor:</p>
              <p className="mt-1 font-mono">
                pH: {pending.ph_value == null ? "—" : Number(pending.ph_value).toFixed(2)} · TDS:{" "}
                {pending.tds_value} ppm · Suhu: {pending.temperature}°C · {pending.quality_status}
              </p>
              {pending.device_id && (
                <p className="mt-1 text-xs text-muted-foreground">Device: {pending.device_id}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Nama Pemilik Latex</Label>
              <Input
                id="owner"
                placeholder="Contoh: Ahmad Sutisna"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                list="owner-suggestions"
              />
              <datalist id="owner-suggestions">
                {owners.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Lokasi akan diambil otomatis saat Anda klik Simpan
            </p>
            {history.length > 0 && (
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs font-semibold text-muted-foreground">Riwayat (terakhir)</div>
                <div className="mt-2 space-y-1 text-xs">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("id-ID")}</span>
                      <span className="font-mono">
                        pH {h.ph_value == null ? "—" : Number(h.ph_value).toFixed(2)} · TDS {h.tds_value} · {h.quality_status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSkip} disabled={loading}>
            Tutup
          </Button>
          <Button onClick={handleSave} disabled={loading || !ownerName.trim()}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
