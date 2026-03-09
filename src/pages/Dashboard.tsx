import { DashboardLayout } from "@/components/DashboardLayout";
import { SensorCard } from "@/components/SensorCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Droplets, Waves, Thermometer, ShieldCheck, Plus, Battery, Activity, AlertTriangle, WifiOff, Loader2, Clock, Cpu } from "lucide-react";
import { classifyLatex, type StatusColor } from "@/lib/latex-utils";
import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";
import { useMeasurements, useInsertMeasurement } from "@/hooks/use-measurements";
import { useDevices } from "@/hooks/use-devices";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PLACEHOLDER = "Menunggu Data Sensor";

function statusToColor(status: string): StatusColor {
  if (status === "Mutu Prima") return "success";
  if (status === "Mutu Rendah Asam") return "danger";
  return "warning";
}

const Dashboard = () => {
  const { data: measurements, loading } = useMeasurements();
  const { devices } = useDevices();
  const { insert } = useInsertMeasurement();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({ ownerName: "", ph: "", tds: "", temperature: "" });
  const [submitting, setSubmitting] = useState(false);

  const latest = measurements[0];
  const hasData = !!latest;
  const fromMqtt = latest?.source === "mqtt";
  const deviceOnline = useMemo(() => {
    if (!latest?.device_id) return null;
    const dev = devices.find((d) => d.id === latest.device_id);
    return dev?.online ?? null;
  }, [latest?.device_id, devices]);
  const lastUpdateStr = latest ? new Date(latest.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : "—";

  const latestPh = latest?.ph_value ?? 7.0;
  const latestTds = latest?.tds_value ?? 500;
  const latestTemp = latest?.temperature ?? 28;
  const latestVoltage = latest?.voltage_probe ?? null;
  const latestBattery = latest?.battery_level ?? null;
  const latestProbe = (latest?.probe_status ?? "unknown").toLowerCase();
  const latestClassification = classifyLatex(latestPh, latestTds);
  const latestQuality = latest?.quality_status ?? latestClassification.status;
  const latestQualityColor = statusToColor(latestQuality);

  const timeData = useMemo(() => {
    if (!measurements.length) return [];
    return measurements.slice(0, 30).reverse().map((m) => ({
      time: new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      ph: m.ph_value ?? 0,
      tds: m.tds_value,
      temperature: m.temperature,
    }));
  }, [measurements]);

  const handleAdd = async () => {
    if (!formData.ownerName || !formData.ph || !formData.tds || !formData.temperature) {
      toast.error("Semua field harus diisi");
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
    } catch { /* ignore */ }
    const { error } = await insert({
      ownerName: formData.ownerName,
      ph: parseFloat(formData.ph),
      tds: parseInt(formData.tds),
      temperature: parseFloat(formData.temperature),
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

  const probeSubtitle =
    latestProbe === "liquid_detected"
      ? "Liquid detected"
      : latestProbe === "probe_dry"
        ? "Probe belum dicelupkan"
        : "Menunggu data dari sensor";
  const probeVariant: "success" | "warning" | "danger" =
    latestProbe === "liquid_detected" ? "success" : latestProbe === "probe_dry" ? "danger" : "warning";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Monitoring kualitas lateks secara realtime</p>
          </div>
          <div className="flex items-center gap-2">
            {latest?.device_id && deviceOnline === false && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1.5 rounded-lg">
                <WifiOff className="h-3.5 w-3.5" /> Device Offline
              </span>
            )}
            {!fromMqtt && hasData && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">Data manual / seed. Untuk ESP32: kirim ke topic <code className="bg-muted px-1 rounded">latex/iot/data</code></span>
            )}
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Data
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SensorCard
            title="Suhu"
            value={hasData ? latestTemp : PLACEHOLDER}
            unit={hasData ? "°C" : ""}
            icon={Thermometer}
            variant="primary"
            subtitle={hasData ? (fromMqtt ? "Realtime dari ESP32" : "Data terakhir") : ""}
          />
          <SensorCard
            title="Nilai TDS"
            value={hasData ? latestTds : PLACEHOLDER}
            unit={hasData ? "ppm" : ""}
            icon={Waves}
            variant={hasData && (latestTds <= 300 || latestTds >= 800) ? "warning" : "success"}
            subtitle={hasData ? "Total Dissolved Solids" : ""}
          />
          <SensorCard
            title="Tegangan Probe"
            value={hasData && latestVoltage != null ? Number(latestVoltage).toFixed(2) : hasData ? "—" : PLACEHOLDER}
            unit={hasData && latestVoltage != null ? "V" : ""}
            icon={Activity}
            variant="primary"
            subtitle={hasData ? (fromMqtt ? "Voltage probe" : "Dari manual") : ""}
          />
          <SensorCard
            title="Status Probe"
            value={hasData ? (latestProbe === "liquid_detected" ? "Cair Terdeteksi" : latestProbe === "probe_dry" ? "Probe Kering" : "Probe Tidak Terdeteksi") : PLACEHOLDER}
            unit=""
            icon={latestProbe === "liquid_detected" ? Droplets : AlertTriangle}
            variant={probeVariant}
            subtitle={probeSubtitle}
          />
          <SensorCard
            title="Battery Device"
            value={hasData && latestBattery != null ? Number(latestBattery).toFixed(1) : hasData ? "—" : PLACEHOLDER}
            unit={hasData && latestBattery != null ? "%" : ""}
            icon={Battery}
            variant={hasData && latestBattery != null && Number(latestBattery) < 25 ? "danger" : "primary"}
            subtitle={latest?.device_id ? `Device: ${latest.device_id}` : ""}
          />
          <SensorCard
            title="Mutu Lateks"
            value={hasData ? latestQuality.split(" ")[0] : PLACEHOLDER}
            unit=""
            icon={ShieldCheck}
            variant={latestQualityColor}
            subtitle={hasData ? latestQuality : ""}
          />
          <SensorCard
            title="Terakhir Update"
            value={lastUpdateStr}
            unit=""
            icon={Clock}
            variant="primary"
            subtitle={hasData ? "Waktu data terakhir" : ""}
          />
          <SensorCard
            title="Device"
            value={latest?.device_id ?? "—"}
            unit=""
            icon={Cpu}
            variant={latest?.device_id ? "primary" : "warning"}
            subtitle={fromMqtt ? "ESP32 via MQTT" : "Manual / belum dari MQTT"}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border bg-card p-5"
          >
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Tren Suhu & TDS</h3>
            {timeData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : "Belum ada data historis"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                  <YAxis yAxisId="temp" domain={[20, 40]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="tds" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--card-foreground))" }} />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} name="Suhu (°C)" isAnimationActive />
                  <Line yAxisId="tds" type="monotone" dataKey="tds" stroke="hsl(200, 80%, 55%)" strokeWidth={2} dot={false} name="TDS (ppm)" isAnimationActive />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-xl border bg-card p-5"
          >
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Tren Suhu</h3>
            {timeData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : "Belum ada data historis"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={timeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                  <YAxis domain={[24, 36]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--card-foreground))" }} />
                  <Area type="monotone" dataKey="temperature" stroke="hsl(38, 92%, 50%)" fill="hsl(38, 92%, 50%, 0.1)" strokeWidth={2} name="Suhu (°C)" isAnimationActive />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Pengukuran Terbaru</h3>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
            </div>
          ) : measurements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Belum ada data. Klik &quot;Tambah Data&quot; atau tunggu data dari MQTT.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Pemilik</th>
                    <th className="pb-3 font-medium text-muted-foreground">pH</th>
                    <th className="pb-3 font-medium text-muted-foreground">TDS</th>
                    <th className="pb-3 font-medium text-muted-foreground">Suhu</th>
                    <th className="pb-3 font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 font-medium text-muted-foreground hidden sm:table-cell">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.slice(0, 5).map((m) => (
                    <tr key={m.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 font-medium text-card-foreground">{m.owner_name}</td>
                      <td className="py-3 font-mono">{m.ph_value ?? "—"}</td>
                      <td className="py-3 font-mono">{m.tds_value}</td>
                      <td className="py-3 font-mono">{m.temperature}°C</td>
                      <td className="py-3">
                        <StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} />
                      </td>
                      <td className="py-3 text-muted-foreground hidden sm:table-cell text-xs">{new Date(m.created_at).toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Data Pengukuran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Pemilik Lateks</Label>
                <Input value={formData.ownerName} onChange={(e) => setFormData((p) => ({ ...p, ownerName: e.target.value }))} placeholder="Nama pemilik" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>pH</Label>
                  <Input type="number" step="0.1" value={formData.ph} onChange={(e) => setFormData((p) => ({ ...p, ph: e.target.value }))} placeholder="7.0" />
                </div>
                <div className="space-y-2">
                  <Label>TDS (ppm)</Label>
                  <Input type="number" value={formData.tds} onChange={(e) => setFormData((p) => ({ ...p, tds: e.target.value }))} placeholder="500" />
                </div>
                <div className="space-y-2">
                  <Label>Suhu (°C)</Label>
                  <Input type="number" step="0.1" value={formData.temperature} onChange={(e) => setFormData((p) => ({ ...p, temperature: e.target.value }))} placeholder="28" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Lokasi GPS akan diambil otomatis dari browser</p>
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
