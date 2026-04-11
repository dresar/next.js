import { FarmerLayout } from "@/components/FarmerLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { type StatusColor } from "@/lib/latex-utils";
import { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
};

const PER_PAGE = 15;

function statusToColor(status: string): StatusColor {
  const s = status.toLowerCase();
  if (s.includes("prima")) return "success";
  if (s.includes("asam") || s.includes("buruk") || s.includes("rendah")) return "danger";
  return "warning";
}

export default function FarmerMeasurements() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchRows = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("owner", search);
    if (statusFilter && statusFilter !== "all") params.set("quality_status", statusFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("limit", "1000");

    try {
      const data = await apiFetch<MeasurementRow[]>(`/api/measurements?${params.toString()}`);
      setRows(data.filter((m) => m.owner_name !== "Unknown"));
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal memuat data");
    }
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    fetchRows();
  }, [search, statusFilter, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [rows, currentPage]
  );

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
      a.download = "data_latex_saya.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV berhasil diunduh");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal export");
    }
  };

  return (
    <FarmerLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Data Pengukuran
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Riwayat pengukuran latex milik Anda</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 text-xs self-start">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari pemilik..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[170px] h-9 text-sm">
              <SelectValue placeholder="Filter mutu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Mutu</SelectItem>
              <SelectItem value="Mutu Prima">Mutu Prima</SelectItem>
              <SelectItem value="Mutu Rendah (Asam)">Mutu Rendah</SelectItem>
              <SelectItem value="Terawetkan Amonia">Terawetkan Amonia</SelectItem>
              <SelectItem value="Indikasi Kontaminasi">Kontaminasi</SelectItem>
              <SelectItem value="Indikasi Oplos Air">Oplos Air</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full sm:w-[140px] h-9 text-sm" />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full sm:w-[140px] h-9 text-sm" />
          </div>
        </div>

        {/* Data */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="h-8 w-8 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Tidak ada data ditemukan.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden divide-y">
                {paginatedRows.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate flex-1 mr-2">{m.owner_name}</span>
                      <StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">pH: </span>
                        <span className="font-mono font-medium">{m.ph_value != null ? Number(m.ph_value).toFixed(1) : "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">TDS: </span>
                        <span className="font-mono font-medium">{m.tds_value}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Suhu: </span>
                        <span className="font-mono font-medium">{Number(m.temperature).toFixed(1)}°</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("id-ID")}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-3 text-left font-medium text-muted-foreground">#</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Pemilik</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">pH</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">TDS (ppm)</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Suhu</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Mutu</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((m, i) => (
                      <tr key={m.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground">{(currentPage - 1) * PER_PAGE + i + 1}</td>
                        <td className="p-3 font-medium">{m.owner_name}</td>
                        <td className="p-3 font-mono">{m.ph_value != null ? Number(m.ph_value).toFixed(2) : "—"}</td>
                        <td className="p-3 font-mono">{m.tds_value}</td>
                        <td className="p-3 font-mono">{Number(m.temperature).toFixed(1)}°C</td>
                        <td className="p-3"><StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} /></td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 px-3 sm:px-4 py-3 border-t text-sm text-muted-foreground">
                  <span className="text-xs">
                    {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, rows.length)} dari {rows.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs min-w-[60px] text-center">{currentPage}/{totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </FarmerLayout>
  );
}
