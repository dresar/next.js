import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { type StatusColor } from "@/lib/latex-utils";
import { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type MeasurementRow = {
  id: string;
  owner_name: string;
  ph_value: number | null;
  tds_value: number;
  temperature: number;
  quality_status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  device_id: string | null;
  voltage_probe: number | null;
  battery_level: number | null;
  probe_status: string | null;
  device_status: string | null;
};

function statusToColor(status: string): StatusColor {
  if (status === "Mutu Prima") return "success";
  if (status === "Mutu Rendah Asam") return "danger";
  return "warning";
}

const Measurements = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("owner", search);
    if (statusFilter && statusFilter !== "all") params.set("quality_status", statusFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("limit", "1000");

    const data = await apiFetch<MeasurementRow[]>(`/api/measurements?${params.toString()}`);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows().catch((err) => {
      toast.error((err as { message?: string })?.message ?? "Gagal memuat data");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, fromDate, toDate]);

  const filtered = useMemo(() => {
    return rows;
  }, [rows]);

  const exportCsv = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) throw new Error("Belum login");
      const params = new URLSearchParams();
      if (search) params.set("owner", search);
      if (statusFilter && statusFilter !== "all") params.set("quality_status", statusFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/measurements.csv?${params.toString()}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal export CSV");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "latex_measurements.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal export");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Pengukuran</h1>
          <p className="text-sm text-muted-foreground">Data lengkap pengukuran kualitas lateks</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama pemilik..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="Mutu Prima">Mutu Prima</SelectItem>
              <SelectItem value="Mutu Rendah Asam">Mutu Rendah</SelectItem>
              <SelectItem value="Terawetkan Amonia">Terawetkan</SelectItem>
              <SelectItem value="Indikasi Oplos Air">Oplos Air</SelectItem>
              <SelectItem value="Indikasi Kontaminasi">Kontaminasi</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full sm:w-[180px]" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full sm:w-[180px]" />
          <Button variant="outline" onClick={exportCsv} className="w-full sm:w-auto">Export CSV</Button>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Memuat data...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left font-medium text-muted-foreground">#</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Pemilik</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">pH</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">TDS</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Suhu</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Probe</th>
                      <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Battery</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Lokasi</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => (
                    <tr key={m.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 font-medium">{m.owner_name}</td>
                      <td className="p-3 font-mono">{m.ph_value ?? "—"}</td>
                      <td className="p-3 font-mono">{m.tds_value}</td>
                      <td className="p-3 font-mono">{m.temperature}°C</td>
                      <td className="p-3 hidden md:table-cell text-xs">
                        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full ${m.probe_status === "liquid_detected" ? "bg-success/10 text-success" : m.probe_status === "probe_dry" ? "bg-muted text-muted-foreground" : "bg-muted/40 text-muted-foreground"}`}>
                          <span className={`h-2 w-2 rounded-full ${m.probe_status === "liquid_detected" ? "bg-success" : "bg-muted-foreground/50"}`} />
                          {m.probe_status ?? "unknown"}
                        </span>
                      </td>
                      <td className="p-3 hidden md:table-cell text-xs font-mono">{m.battery_level == null ? "—" : `${m.battery_level.toFixed(1)}%`}</td>
                      <td className="p-3"><StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} /></td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{m.latitude?.toFixed(4)}, {m.longitude?.toFixed(4)}</td>
                      <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">{new Date(m.created_at).toLocaleString("id-ID")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Tidak ada data yang cocok</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Measurements;
