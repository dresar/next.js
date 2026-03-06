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
  tds_value: number;
  temperature: number;
  quality_status: string;
  device_id: string | null;
  created_at: string;
};

export function MqttOwnerPopup() {
  const [pending, setPending] = useState<PendingMeasurement | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "measurement:new") {
        const m = evt.data as PendingMeasurement;
        const needsOwner = !m.owner_name || m.owner_name === "Unknown" || m.owner_name.trim() === "";
        if (needsOwner) {
          setPending(m);
          setOwnerName("");
        }
      }
      if (evt.type === "measurement:updated" && pending && (evt.data as any).id === pending.id) {
        setPending(null);
      }
    });
    return () => unsub();
  }, [pending?.id]);

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
            Masukkan nama pemilik latex untuk melengkapi data. Lokasi GPS akan diambil otomatis dari perangkat Anda.
          </DialogDescription>
        </DialogHeader>
        {pending && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium text-muted-foreground">Data sensor:</p>
              <p className="mt-1 font-mono">
                TDS: {pending.tds_value} ppm · Suhu: {pending.temperature}°C · {pending.quality_status}
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
              />
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Lokasi akan diambil otomatis saat Anda klik Simpan
            </p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSkip} disabled={loading}>
            Lewati
          </Button>
          <Button onClick={handleSave} disabled={loading || !ownerName.trim()}>
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
