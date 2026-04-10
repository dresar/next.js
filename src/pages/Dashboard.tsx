import { DashboardLayout } from "@/components/DashboardLayout";
import { SensorCard } from "@/components/SensorCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Droplets, Waves, Thermometer, ShieldCheck, Plus, Loader2, Clock } from "lucide-react";
import { classifyLatex, statusToColor } from "@/lib/latex-utils";
import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";
import { useMeasurements, useInsertMeasurement } from "@/hooks/use-measurements";
import { useRealtimeSensor } from "@/hooks/use-realtime-sensor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PLACEHOLDER = "Menunggu Data";

const Dashboard = () => {
  const { data: measurements, loading } = useMeasurements();
  const realtimeSensor = useRealtimeSensor();
  const { insert } = useInsertMeasurement();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({ ownerName: "", ph: "", tds: "", temperature: "" });
  const [submitting, setSubmitting] = useState(false);

  // Prioritas: data realtime dari ESP32 via WS → fallback ke DB terakhir
  const dbLatest = measurements[0];
  const live = realtimeSensor ?? (dbLatest ? {
    ph_value: dbLatest.ph_value,
    tds_value: dbLatest.tds_value,
    temperature: dbLatest.temperature,
    quality_status: dbLatest.quality_status,
    probe_status: dbLatest.probe_status,
    owner_name: dbLatest.owner_name,
    source: dbLatest.source,
    created_at: dbLatest.created_at,
  } : null);

  const hasData = !!live;
  const isLive = !!realtimeSensor;

  const ph = live?.ph_value ?? null;
  const tds = live?.tds_value ?? 0;
  const temp = live?.temperature ?? 0;
  const quality = live?.quality_status ?? (hasData ? classifyLatex(ph, tds).status : "");
  const lastUpdate = live ? new Date(live.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" }) : "—";

  const timeData = useMemo(() => {
    if (!measurements.length) return [];
    return measurements.slice(0, 30).reverse().map((m) => ({
      time: new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      ph: m.ph_value ?? 0,
      tds: m.tds_value,
      suhu: m.temperature,
    }));
  }, [measurements]);

  const handleAdd = async () => {
    if (!formData.ownerName || !formData.tds || !formData.temperature) {
      toast.error("Nama pemilik, TDS, dan Suhu wajib diisi");
      return;
    }
    setSubmitting(true);
    let lat: number | undefined, lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* tanpa GPS */ }
    const phVal = formData.ph ? parseFloat(formData.ph) : null;
    const tdsVal = parseInt(formData.tds) || 0;
    const tempVal = parseFloat(formData.temperature) || 0;
    const { status } = classifyLatex(phVal, tdsVal);

    const { error } = await insert({
      ownerName: formData.ownerName,
      ph: phVal,
      tds: tdsVal,
      temperature: tempVal,
      quality_status: status,
      probe_status: "liquid_detected",
      latitude: lat,
      longitude: lng,
    });
    if (error) toast.error("Gagal menyimpan: " + error.message);
    else {
      toast.success("Data berhasil disimpan!");
      setShowAddDialog(false);
      setFormData({ ownerName: "", ph: "", tds: "", temperature: "" });
    }
    setSubmitting(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Monitoring kualitas lateks — sensor ESP32 via HiveMQ
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Live ESP32
              </span>
            )}
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1.5 text-xs h-8 px-3">
              <Plus className="h-4 w-4" /> Tambah Data
            </Button>
          </div>
        </div>

        {/* ===== SENSOR CARDS — hanya field yang ada di ESP32 ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* pH */}
          <SensorCard
            title="Derajat Asam (pH)"
            value={hasData && ph != null ? Number(ph).toFixed(2) : PLACEHOLDER}
            unit={hasData && ph != null ? "" : ""}
            icon={Droplets}
            variant={
              ph == null ? "primary"
              : ph <= 7.5 ? "danger"
              : ph >= 8.8 ? "warning"
              : "success"
            }
            subtitle={
              ph == null ? "Menunggu sensor"
              : ph <= 7.5 ? "Terlalu asam"
              : ph >= 8.8 ? "Terlalu basa"
              : "Normal (7.6–8.7)"
            }
          />

          {/* TDS */}
          <SensorCard
            title="Nilai TDS"
            value={hasData ? `${tds}` : PLACEHOLDER}
            unit={hasData ? "ppm" : ""}
            icon={Waves}
            variant={
              !hasData ? "primary"
              : tds <= 200 ? "warning"
              : tds <= 500 ? "success"
              : "warning"
            }
            subtitle={
              !hasData ? ""
              : tds <= 200 ? "Probe belum tercelup"
              : tds <= 500 ? "Konsentrasi normal"
              : tds <= 1100 ? "Indikasi kontaminasi"
              : "Terindikasi oplos air"
            }
          />

          {/* Suhu */}
          <SensorCard
            title="Suhu Cairan"
            value={hasData ? `${Number(temp).toFixed(1)}` : PLACEHOLDER}
            unit={hasData ? "°C" : ""}
            icon={Thermometer}
            variant={
              !hasData ? "primary"
              : temp < 20 || temp > 35 ? "warning"
              : "primary"
            }
            subtitle={
              !hasData ? ""
              : isLive ? "Realtime ESP32 (ATC)" : "Data tersimpan terakhir"
            }
          />

          {/* Mutu / Status */}
          <SensorCard
            title="Mutu Lateks"
            value={hasData ? quality : PLACEHOLDER}
            unit=""
            icon={ShieldCheck}
            variant={
              hasData ? (statusToColor(quality) === "muted" ? "primary" : statusToColor(quality)) : "primary"
            }
            subtitle={hasData ? `Update: ${lastUpdate}` : ""}
          />
        </div>

        {/* Indikator update terakhir */}
        {hasData && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Data {isLive ? "realtime dari ESP32" : "tersimpan terakhir"} &bull;
              {live?.owner_name ? ` Pemilik: ${live.owner_name} •` : ""} {lastUpdate}
            </span>
          </div>
        )}

        {/* Grafik */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border bg-card p-4"
          >
            <h3 className="text-xs font-semibold text-card-foreground mb-3">Tren pH &amp; TDS (Data Tersimpan)</h3>
            {timeData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
{ "Belum ada data tersimpan"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                  <YAxis yAxisId="ph" domain={[6, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="tds" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--card-foreground))" }} />
                  <Line yAxisId="ph" type="monotone" dataKey="ph" stroke="hsl(142, 76%, 46%)" strokeWidth={2} dot={false} name="pH" />
                  <Line yAxisId="tds" type="monotone" dataKey="tds" stroke="hsl(200, 80%, 55%)" strokeWidth={2} dot={false} name="TDS (ppm)" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-xl border bg-card p-4"
          >
            <h3 className="text-xs font-semibold text-card-foreground mb-3">Tren Suhu (°C)</h3>
            {timeData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">
{ "Belum ada data tersimpan"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                  <YAxis domain={[24, 36]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--card-foreground))" }} />
                  <Area type="monotone" dataKey="suhu" stroke="hsl(38, 92%, 50%)" fill="hsl(38 92% 50% / 0.1)" strokeWidth={2} name="Suhu (°C)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* Tabel data tersimpan */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="rounded-xl border bg-card p-4"
        >
          <h3 className="text-xs font-semibold text-card-foreground mb-3">Pengukuran Tersimpan (5 Terakhir)</h3>
          {measurements.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">
              Belum ada data tersimpan. Data masuk ke database hanya saat klik &quot;Simpan&quot; di popup sensor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Pemilik</th>
                    <th className="pb-2 font-medium text-muted-foreground">pH</th>
                    <th className="pb-2 font-medium text-muted-foreground">TDS</th>
                    <th className="pb-2 font-medium text-muted-foreground">Suhu</th>
                    <th className="pb-2 font-medium text-muted-foreground">Mutu</th>
                    <th className="pb-2 font-medium text-muted-foreground hidden sm:table-cell">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.slice(0, 5).map((m) => (
                    <tr key={m.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-2 font-medium">{m.owner_name}</td>
                      <td className="py-2 font-mono">{m.ph_value != null ? Number(m.ph_value).toFixed(2) : "—"}</td>
                      <td className="py-2 font-mono">{m.tds_value} ppm</td>
                      <td className="py-2 font-mono">{Number(m.temperature).toFixed(1)}°C</td>
                      <td className="py-2">
                        <StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} />
                      </td>
                      <td className="py-2 text-muted-foreground hidden sm:table-cell">
                        {new Date(m.created_at).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Dialog Tambah Manual */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Data Pengukuran Manual</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Pemilik Latex</Label>
                <Input
                  value={formData.ownerName}
                  onChange={(e) => setFormData((p) => ({ ...p, ownerName: e.target.value }))}
                  placeholder="Nama pemilik"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>pH <span className="text-muted-foreground text-[10px]">(opsional)</span></Label>
                  <Input type="number" step="0.01" min="0" max="14" value={formData.ph} onChange={(e) => setFormData((p) => ({ ...p, ph: e.target.value }))} placeholder="7.5" />
                </div>
                <div className="space-y-2">
                  <Label>TDS (ppm)</Label>
                  <Input type="number" value={formData.tds} onChange={(e) => setFormData((p) => ({ ...p, tds: e.target.value }))} placeholder="400" />
                </div>
                <div className="space-y-2">
                  <Label>Suhu (°C)</Label>
                  <Input type="number" step="0.1" value={formData.temperature} onChange={(e) => setFormData((p) => ({ ...p, temperature: e.target.value }))} placeholder="28.5" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Lokasi GPS diambil otomatis dari browser</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
              <Button onClick={handleAdd} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
