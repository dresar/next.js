import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { Trash2, UserPlus, Users, Clock, Droplets } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { subscribeRealtime } from "@/lib/realtime";

type OwnerDetail = {
  name: string;
  measurement_count: number;
  last_seen: string | null;
};

type MeasurementRow = {
  id: string;
  created_at: string;
  owner_name: string;
  ph_value: number | null;
  tds_value: number;
  temperature: number;
  quality_status: string;
  device_id: string | null;
  source: string;
};

const OWNERS_PER_PAGE = 20;
const HISTORY_LIMIT_PER_OWNER = 500;
const PREFETCH_MEASUREMENTS_LIMIT = 5000;

function normalizeMeasurementRow(r: Record<string, unknown>): MeasurementRow {
  const toNum = (v: unknown) => (v == null ? null : Number(v));
  const toStr = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(r.id),
    created_at: String(r.created_at),
    owner_name: String(r.owner_name ?? ""),
    ph_value: toNum(r.ph_value),
    tds_value: Number(r.tds_value) || 0,
    temperature: Number(r.temperature) || 0,
    quality_status: String(r.quality_status ?? ""),
    device_id: toStr(r.device_id),
    source: String(r.source ?? "manual"),
  };
}

export default function OwnersPage() {
  const [owners, setOwners] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [byOwner, setByOwner] = useState<Record<string, MeasurementRow[]>>({});
  const [page, setPage] = useState(1);

  const filteredOwners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return owners;
    return owners.filter((n) => n.toLowerCase().includes(q));
  }, [owners, search]);

  const fetchOwners = useCallback(async () => {
    setLoadingOwners(true);
    try {
      const rows = await apiFetch<string[]>("/api/owners");
      setOwners(rows);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal memuat daftar pemilik");
    } finally {
      setLoadingOwners(false);
    }
  }, []);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (selected) return;
    if (loadingOwners) return;
    if (owners.length === 0) return;
    setSelected(owners[0] ?? "");
  }, [loadingOwners, owners, selected]);

  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    apiFetch<Record<string, unknown>[]>(`/api/measurements?limit=${PREFETCH_MEASUREMENTS_LIMIT}`)
      .then((rows) => {
        if (cancelled) return;
        const map: Record<string, MeasurementRow[]> = {};
        for (const raw of rows) {
          const m = normalizeMeasurementRow(raw);
          const name = (m.owner_name || "Unknown").trim() || "Unknown";
          const arr = map[name] ?? (map[name] = []);
          if (!arr.some((x) => x.id === m.id)) arr.push(m);
        }
        for (const k of Object.keys(map)) {
          map[k] = map[k]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, HISTORY_LIMIT_PER_OWNER);
        }
        setByOwner(map);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error((err as { message?: string })?.message ?? "Gagal memuat data riwayat");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeRealtime((evt) => {
      if (evt.type !== "measurement:new") return;
      const raw = evt.data as Record<string, unknown>;
      const m = normalizeMeasurementRow(raw);
      const name = (m.owner_name || "Unknown").trim() || "Unknown";

      setByOwner((prev) => {
        const current = prev[name] ?? [];
        const next = [m, ...current.filter((x) => x.id !== m.id)].slice(0, HISTORY_LIMIT_PER_OWNER);
        return { ...prev, [name]: next };
      });

      setOwners((prev) => (prev.includes(name) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))));
    });
    return () => unsub();
  }, []);

  const selectedHistory = useMemo(() => {
    if (!selected) return [];
    return byOwner[selected] ?? [];
  }, [byOwner, selected]);

  const selectedDetail: OwnerDetail | null = useMemo(() => {
    if (!selected) return null;
    const arr = byOwner[selected] ?? [];
    return {
      name: selected,
      measurement_count: arr.length,
      last_seen: arr[0]?.created_at ?? null,
    };
  }, [byOwner, selected]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredOwners.length / OWNERS_PER_PAGE)), [filteredOwners.length]);
  const pagedOwners = useMemo(() => {
    const p = Math.min(Math.max(page, 1), totalPages);
    const start = (p - 1) * OWNERS_PER_PAGE;
    return filteredOwners.slice(start, start + OWNERS_PER_PAGE);
  }, [filteredOwners, page, totalPages]);

  const addOwner = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Nama pemilik tidak boleh kosong");
      return;
    }
    try {
      await apiFetch("/api/owners", { method: "POST", body: JSON.stringify({ name }) });
      toast.success("Pemilik ditambahkan");
      setNewName("");
      setOwners((prev) => (prev.includes(name) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b))));
      setSelected(name);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menambah pemilik");
    }
  };

  const deleteOwner = async () => {
    const name = selected.trim();
    if (!name) return;
    try {
      await apiFetch(`/api/owners/${encodeURIComponent(name)}`, { method: "DELETE" });
      toast.success("Pemilik dihapus dari daftar");
      const next = owners.filter((x) => x !== name);
      setOwners(next);
      setSelected(next[0] ?? "");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menghapus pemilik");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pemilik Latex</h1>
          <p className="text-sm text-muted-foreground">
            Tambah pemilik, lihat detail, dan riwayat pengecekan berdasarkan nama.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/30 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Daftar Pemilik
              </div>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Tambah nama pemilik..."
                  onKeyDown={(e) => e.key === "Enter" && addOwner()}
                />
                <Button onClick={addOwner} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Tambah
                </Button>
              </div>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama..." />
            </div>

            <div className="p-2 max-h-[520px] overflow-auto">
              {loadingOwners ? (
                <div className="p-4 text-sm text-muted-foreground">Memuat...</div>
              ) : pagedOwners.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Belum ada pemilik.</div>
              ) : (
                <div className="space-y-1">
                  {pagedOwners.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelected(name)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selected === name ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!loadingOwners && filteredOwners.length > 0 && totalPages > 1 && (
              <div className="p-3 border-t bg-muted/20 flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Prev
                </Button>
                <div className="text-xs text-muted-foreground">
                  Halaman {Math.min(Math.max(page, 1), totalPages)} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{selected || "Pilih pemilik"}</div>
                {selectedDetail?.last_seen && (
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mt-1">
                    <Clock className="h-3.5 w-3.5" />
                    Terakhir update: {new Date(selectedDetail.last_seen).toLocaleString("id-ID")}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={deleteOwner} disabled={!selected} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Hapus
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {!selected ? (
                <div className="text-sm text-muted-foreground">Pilih pemilik untuk melihat detail.</div>
              ) : loadingData ? (
                <div className="text-sm text-muted-foreground">Memuat data...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Total Riwayat</div>
                      <div className="text-lg font-semibold">{selectedDetail?.measurement_count ?? selectedHistory.length}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Rata-rata pH</div>
                      <div className="text-lg font-semibold">
                        {(() => {
                          const nums = selectedHistory.map((x) => x.ph_value).filter((x): x is number => x != null);
                          if (nums.length === 0) return "—";
                          const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
                          return avg.toFixed(2);
                        })()}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <div className="text-xs text-muted-foreground">Data Terbaru</div>
                      <div className="text-lg font-semibold">
                        {selectedHistory[0]?.created_at ? new Date(selectedHistory[0].created_at).toLocaleString("id-ID") : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 text-sm font-medium">
                      <Droplets className="h-4 w-4" />
                      Riwayat Pengecekan
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/10">
                            <th className="p-3 text-left font-medium text-muted-foreground">Waktu</th>
                            <th className="p-3 text-left font-medium text-muted-foreground">pH</th>
                            <th className="p-3 text-left font-medium text-muted-foreground">TDS</th>
                            <th className="p-3 text-left font-medium text-muted-foreground">Suhu</th>
                            <th className="p-3 text-left font-medium text-muted-foreground">Mutu</th>
                            <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Device</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedHistory.map((m) => (
                            <tr key={m.id} className="border-b border-border/30">
                              <td className="p-3 text-xs text-muted-foreground">
                                {new Date(m.created_at).toLocaleString("id-ID")}
                              </td>
                              <td className="p-3 font-mono">{m.ph_value == null ? "—" : m.ph_value.toFixed(2)}</td>
                              <td className="p-3 font-mono">{m.tds_value}</td>
                              <td className="p-3 font-mono">{m.temperature.toFixed(1)}</td>
                              <td className="p-3">{m.quality_status}</td>
                              <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{m.device_id ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {selectedHistory.length === 0 && (
                        <div className="p-6 text-center text-muted-foreground text-sm">Belum ada riwayat.</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
