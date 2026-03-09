import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { type StatusColor } from "@/lib/latex-utils";
import { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Pencil, Trash2, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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

const PER_PAGE = 20;

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
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    ownerName: "",
    ph: "",
    tds: "",
    temperature: "",
  });
  const [creating, setCreating] = useState(false);

  const [editRow, setEditRow] = useState<MeasurementRow | null>(null);
  const [editForm, setEditForm] = useState({ owner_name: "", latitude: "", longitude: "" });
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setPage(1);
    setSelectedIds(new Set());
    fetchRows().catch((err) => {
      toast.error((err as { message?: string })?.message ?? "Gagal memuat data");
      setLoading(false);
    });
  }, [search, statusFilter, fromDate, toDate]);

  const filtered = useMemo(() => rows, [rows]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [filtered, currentPage]
  );

  const onPageChange = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRows.map((m) => m.id)));
    }
  };

  const handleCreate = async () => {
    if (!createForm.ownerName.trim() || !createForm.tds || !createForm.temperature) {
      toast.error("Nama pemilik, TDS, dan Suhu wajib diisi");
      return;
    }
    setCreating(true);
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // ignore
    }
    try {
      await apiFetch("/api/measurements", {
        method: "POST",
        body: JSON.stringify({
          ownerName: createForm.ownerName.trim(),
          ph: createForm.ph ? parseFloat(createForm.ph) : null,
          tds: parseInt(createForm.tds, 10),
          temperature: parseFloat(createForm.temperature),
          latitude: lat ?? null,
          longitude: lng ?? null,
        }),
      });
      toast.success("Data berhasil ditambah");
      setShowCreate(false);
      setCreateForm({ ownerName: "", ph: "", tds: "", temperature: "" });
      fetchRows();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menambah data");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (m: MeasurementRow) => {
    setEditRow(m);
    setEditForm({
      owner_name: m.owner_name,
      latitude: m.latitude != null ? String(m.latitude) : "",
      longitude: m.longitude != null ? String(m.longitude) : "",
    });
  };

  const handleUpdate = async () => {
    if (!editRow) return;
    if (!editForm.owner_name.trim()) {
      toast.error("Nama pemilik wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/measurements/${editRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          owner_name: editForm.owner_name.trim(),
          latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
          longitude: editForm.longitude ? parseFloat(editForm.longitude) : null,
        }),
      });
      toast.success("Data berhasil diubah");
      setEditRow(null);
      fetchRows();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal mengubah data");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOne = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/measurements/${deleteId}`, { method: "DELETE" });
      toast.success("Data berhasil dihapus");
      setDeleteId(null);
      fetchRows();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menghapus");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const res = await apiFetch<{ deleted: number }>("/api/measurements/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      toast.success(`${res.deleted} data berhasil dihapus`);
      setShowBulkDelete(false);
      setSelectedIds(new Set());
      fetchRows();
      if (paginatedRows.length <= selectedIds.size && currentPage > 1) setPage(currentPage - 1);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menghapus massal");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("owner", search);
      if (statusFilter && statusFilter !== "all") params.set("quality_status", statusFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await apiFetch<{ deleted: number }>(`/api/measurements?${params.toString()}`, {
        method: "DELETE",
      });
      toast.success(`${res.deleted} data berhasil dihapus`);
      setDeleteAll(false);
      setSelectedIds(new Set());
      fetchRows();
      setPage(1);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menghapus");
    } finally {
      setDeleting(false);
    }
  };

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
      toast.success("CSV berhasil diunduh");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal export");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Riwayat Pengukuran</h1>
            <p className="text-sm text-muted-foreground">CRUD data pengukuran kualitas lateks</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDelete(true)}
              disabled={selectedIds.size === 0}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" /> Hapus Massal ({selectedIds.size})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteAll(true)}
              disabled={filtered.length === 0}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" /> Hapus Semua
            </Button>
          </div>
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
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 w-10">
                      <Checkbox
                        checked={paginatedRows.length > 0 && selectedIds.size === paginatedRows.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Pilih semua"
                      />
                    </th>
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
                    <th className="p-3 text-left font-medium text-muted-foreground w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((m, i) => (
                    <tr key={m.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="p-3">
                        <Checkbox
                          checked={selectedIds.has(m.id)}
                          onCheckedChange={() => toggleSelect(m.id)}
                          aria-label={`Pilih ${m.owner_name}`}
                        />
                      </td>
                      <td className="p-3 text-muted-foreground">{(currentPage - 1) * PER_PAGE + i + 1}</td>
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
                      <td className="p-3 hidden md:table-cell text-xs font-mono">{m.battery_level == null ? "—" : `${Number(m.battery_level).toFixed(1)}%`}</td>
                      <td className="p-3"><StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} /></td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{m.latitude != null ? Number(m.latitude).toFixed(4) : "—"}, {m.longitude != null ? Number(m.longitude).toFixed(4) : "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground hidden sm:table-cell">{new Date(m.created_at).toLocaleString("id-ID")}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(m.id)} title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Tidak ada data. Klik &quot;Tambah&quot; untuk menambah.</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-t text-sm text-muted-foreground">
              <span>
                Menampilkan {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} dari {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[80px] text-center">
                  Hal {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog Tambah */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Pengukuran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Pemilik</Label>
              <Input value={createForm.ownerName} onChange={(e) => setCreateForm((p) => ({ ...p, ownerName: e.target.value }))} placeholder="Nama pemilik lateks" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>pH (opsional)</Label>
                <Input type="number" step="0.1" value={createForm.ph} onChange={(e) => setCreateForm((p) => ({ ...p, ph: e.target.value }))} placeholder="7.0" />
              </div>
              <div className="space-y-2">
                <Label>TDS (ppm)</Label>
                <Input type="number" value={createForm.tds} onChange={(e) => setCreateForm((p) => ({ ...p, tds: e.target.value }))} placeholder="500" />
              </div>
              <div className="space-y-2">
                <Label>Suhu (°C)</Label>
                <Input type="number" step="0.1" value={createForm.temperature} onChange={(e) => setCreateForm((p) => ({ ...p, temperature: e.target.value }))} placeholder="28" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Lokasi GPS akan diambil otomatis dari browser saat simpan.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pengukuran</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Pemilik</Label>
                <Input value={editForm.owner_name} onChange={(e) => setEditForm((p) => ({ ...p, owner_name: e.target.value }))} placeholder="Nama pemilik" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Latitude (opsional)</Label>
                  <Input value={editForm.latitude} onChange={(e) => setEditForm((p) => ({ ...p, latitude: e.target.value }))} placeholder="Contoh: -2.5" />
                </div>
                <div className="space-y-2">
                  <Label>Longitude (opsional)</Label>
                  <Input value={editForm.longitude} onChange={(e) => setEditForm((p) => ({ ...p, longitude: e.target.value }))} placeholder="Contoh: 108.2" />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button onClick={handleUpdate} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi Hapus Massal */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} data yang dipilih?</AlertDialogTitle>
            <AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : "Hapus Massal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi Hapus Satu */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
            <AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOne} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi Hapus Semua */}
      <AlertDialog open={deleteAll} onOpenChange={setDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus semua data?</AlertDialogTitle>
            <AlertDialogDescription>
              {search || statusFilter !== "all" || fromDate || toDate
                ? `Semua data yang sesuai filter (${filtered.length} baris) akan dihapus. Tidak dapat dikembalikan.`
                : "Semua data pengukuran akan dihapus permanen. Tidak dapat dikembalikan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Menghapus..." : "Hapus Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Measurements;
