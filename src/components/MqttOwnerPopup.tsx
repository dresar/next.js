import { useEffect, useRef, useState } from "react";
import { subscribeRealtime, subscribeMqttStatus, MqttStatus } from "@/lib/realtime";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Droplets, Wifi, WifiOff, Loader2, ChevronDown, Check, BellOff, Bell, MapPin } from "lucide-react";

const MODAL_ENABLED_KEY = "mqttModalEnabled";

// Field yang dikirim ESP32 + derived fields dari server
type RealtimeData = {
  ph_value: number | null;
  tds_value: number;
  temperature: number;
  quality_status: string;
  probe_status: string | null;
  device_id: string | null;
  owner_name: string | null;
  source: string;
  created_at: string;
};



/** Mutu ESP32 yang menandakan probe di udara — jangan tampilkan modal */
const SKIP_STATUSES = ["tidak ada sampel", "probe_dry"];

function shouldSkip(qualityStatus: string | null | undefined): boolean {
  const s = (qualityStatus ?? "").trim().toLowerCase();
  return SKIP_STATUSES.some((x) => s.includes(x));
}

export function MqttOwnerPopup() {
  const [pending, setPending] = useState<RealtimeData | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>("connecting");
  const [showDropdown, setShowDropdown] = useState(false);
  const [modalEnabled, setModalEnabled] = useState<boolean>(
    () => localStorage.getItem(MODAL_ENABLED_KEY) !== "false"
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<RealtimeData[]>([]);
  const hasActiveRef = useRef(false);

  const toggleModal = () => {
    setModalEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(MODAL_ENABLED_KEY, String(next));
      if (!next) { setPending(null); hasActiveRef.current = false; }
      return next;
    });
  };

  const showNext = () => {
    const next = queueRef.current.shift();
    if (next) {
      hasActiveRef.current = true;
      setPending(next);
      setOwnerName((next.owner_name ?? "").trim());
    } else {
      hasActiveRef.current = false;
    }
  };

  const addToQueue = (data: RealtimeData) => {
    if (!modalEnabled) return;
    if (shouldSkip(data.quality_status)) return; // probe di udara, skip
    if (hasActiveRef.current) {
      if (!queueRef.current.find((x) => x.created_at === data.created_at)) {
        queueRef.current.push(data);
      }
    } else {
      hasActiveRef.current = true;
      setPending(data);
      setOwnerName((data.owner_name ?? "").trim());
    }
  };

  // Subscribe WebSocket server
  useEffect(() => {
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "measurement:realtime") {
        addToQueue(evt.data as RealtimeData);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalEnabled]);

  // Status koneksi MQTT shared
  useEffect(() => {
    return subscribeMqttStatus(setMqttStatus);
  }, []);

  // Ambil daftar nama pemilik
  useEffect(() => {
    if (!pending) return;
    apiFetch<string[]>("/api/owners")
      .then((rows) => setOwners(rows))
      .catch(() => setOwners([]));
  }, [pending]);

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
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* tanpa GPS */ }

      // POST → simpan ke database
      await apiFetch("/api/measurements", {
        method: "POST",
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          ph: pending.ph_value,
          tds: pending.tds_value,
          temperature: pending.temperature,
          latitude: lat,
          longitude: lng,
        }),
      });
      toast.success(`✅ Tersimpan! Pemilik: ${ownerName.trim()}`);
      setPending(null);
      showNext();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menyimpan");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setPending(null);
    showNext();
  };

  const filteredOwners = owners.filter((n) =>
    n.toLowerCase().includes(ownerName.toLowerCase())
  );

  // Warna badge mutu
  const qualityColor =
    (pending?.quality_status ?? "").toLowerCase().includes("prima") ? "text-green-600 dark:text-green-400 bg-green-500/10" :
    (pending?.quality_status ?? "").toLowerCase().includes("asam") || (pending?.quality_status ?? "").toLowerCase().includes("buruk") ? "text-red-600 dark:text-red-400 bg-red-500/10" :
    "text-yellow-600 dark:text-yellow-400 bg-yellow-500/10";

  return (
    <>
      {/* Indikator MQTT + toggle modal */}
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-card border border-border shadow-md px-3 py-1.5 text-xs select-none">
        {mqttStatus === "connected" ? (
          <><Wifi className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400 font-medium">MQTT Live</span></>
        ) : mqttStatus === "connecting" ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500" /><span className="text-yellow-600 dark:text-yellow-400">Connecting</span></>
        ) : (
          <><WifiOff className="h-3.5 w-3.5 text-red-500" /><span className="text-red-600 dark:text-red-400">Offline</span></>
        )}
        <span className="h-3 w-px bg-border" />
        <button
          onClick={toggleModal}
          title={modalEnabled ? "Matikan popup" : "Aktifkan popup"}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${
            modalEnabled
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          {modalEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          <span>{modalEnabled ? "ON" : "OFF"}</span>
        </button>
      </div>

      {/* Modal data ESP32 baru */}
      <Dialog open={!!pending && modalEnabled} onOpenChange={(open) => !open && handleSkip()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Droplets className="h-4 w-4 text-primary" />
              Data Sensor ESP32 Masuk
            </DialogTitle>
          </DialogHeader>

          {pending && (
            <div className="space-y-4">
              {/* Data sensor dari ESP32 */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/60 p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">pH</p>
                  <p className="font-mono font-bold text-sm">
                    {pending.ph_value == null ? "—" : Number(pending.ph_value).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/60 p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">TDS</p>
                  <p className="font-mono font-bold text-sm">{pending.tds_value}<span className="text-[10px] font-normal"> ppm</span></p>
                </div>
                <div className="rounded-lg bg-muted/60 p-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Suhu</p>
                  <p className="font-mono font-bold text-sm">{Number(pending.temperature).toFixed(1)}<span className="text-[10px] font-normal">°C</span></p>
                </div>
              </div>

              {/* Badge status mutu */}
              <div className="flex justify-center">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${qualityColor}`}>
                  {pending.quality_status}
                </span>
              </div>

              {/* Combobox nama pemilik */}
              <div className="space-y-1.5">
                <Label htmlFor="owner-input" className="text-sm">Nama Pemilik Latex</Label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="owner-input"
                    placeholder="Ketik atau pilih nama..."
                    value={ownerName}
                    autoComplete="off"
                    onChange={(e) => { setOwnerName(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { setShowDropdown(false); handleSave(); }
                      if (e.key === "Escape") setShowDropdown(false);
                    }}
                    autoFocus
                    className="pr-8"
                  />
                  <ChevronDown
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
                    onClick={() => { setShowDropdown((v) => !v); inputRef.current?.focus(); }}
                  />
                  {showDropdown && filteredOwners.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-44 overflow-y-auto">
                      {filteredOwners.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setOwnerName(n);
                            setShowDropdown(false);
                          }}
                        >
                          {n.toLowerCase() === ownerName.toLowerCase() && (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                          <span className={n.toLowerCase() === ownerName.toLowerCase() ? "font-medium" : ""}>{n}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Lokasi GPS diambil otomatis saat klik Simpan
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={handleSkip} disabled={loading}>Lewati</Button>
            <Button size="sm" onClick={handleSave} disabled={loading || !ownerName.trim()}>
              {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Menyimpan...</> : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
