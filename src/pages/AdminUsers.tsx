import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Shield, Leaf, Trash2, Bell, UserPlus, Link2, Users } from "lucide-react";
import { motion } from "framer-motion";

type UserRow = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
};

type FarmerOwnerRow = {
  id: string;
  user_id: string;
  owner_name: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [farmerOwners, setFarmerOwners] = useState<FarmerOwnerRow[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Dialogs
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [notifyUser, setNotifyUser] = useState<UserRow | null>(null);
  const [notifyForm, setNotifyForm] = useState({ title: "", message: "", type: "info" });
  const [sending, setSending] = useState(false);

  const [assignUser, setAssignUser] = useState<UserRow | null>(null);
  const [assignOwner, setAssignOwner] = useState("");

  const fetchAll = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [u, fo, o] = await Promise.all([
        apiFetch<UserRow[]>("/api/admin/users"),
        apiFetch<FarmerOwnerRow[]>("/api/admin/farmer-owners"),
        apiFetch<string[]>("/api/owners"),
      ]);
      setUsers(u);
      setFarmerOwners(fo);
      setOwners(o);
    } catch (err) {
      toast.error("Gagal memuat data pengguna");
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") {
      list = list.filter(u => u.role === roleFilter);
    }
    return list;
  }, [users, search, roleFilter]);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "petani" : "admin";
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      toast.success(`Role diubah ke ${newRole}`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal mengubah role");
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/users/${deleteUser.id}`, { method: "DELETE" });
      toast.success("User berhasil dihapus");
      setUsers(prev => prev.filter(u => u.id !== deleteUser.id));
      setDeleteUser(null);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal menghapus");
    }
    setDeleting(false);
  };

  const handleNotify = async () => {
    if (!notifyUser || !notifyForm.title.trim() || !notifyForm.message.trim()) {
      toast.error("Judul dan pesan wajib diisi");
      return;
    }
    setSending(true);
    try {
      await apiFetch(`/api/admin/users/${notifyUser.id}/notify`, {
        method: "POST",
        body: JSON.stringify(notifyForm),
      });
      toast.success("Notifikasi terkirim!");
      setNotifyUser(null);
      setNotifyForm({ title: "", message: "", type: "info" });
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal mengirim notifikasi");
    }
    setSending(false);
  };

  const handleAssign = async () => {
    if (!assignUser || !assignOwner) {
      toast.error("Pilih pemilik latex");
      return;
    }
    try {
      await apiFetch("/api/admin/farmer-owners", {
        method: "POST",
        body: JSON.stringify({ user_id: assignUser.id, owner_name: assignOwner }),
      });
      toast.success("Pemilik latex berhasil di-assign!");
      setAssignUser(null);
      setAssignOwner("");
      fetchAll();
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Gagal assign");
    }
  };

  const handleRemoveAssign = async (foId: string) => {
    try {
      await apiFetch(`/api/admin/farmer-owners/${foId}`, { method: "DELETE" });
      toast.success("Assignment dihapus");
      setFarmerOwners(prev => prev.filter(fo => fo.id !== foId));
    } catch (err) {
      toast.error("Gagal menghapus assignment");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Kelola Pengguna
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Atur role user, assign owner ke petani, kirim notifikasi</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama / email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm">
              <SelectValue placeholder="Filter role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Role</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="petani">Petani</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Mobile Card View */}
          <div className="sm:hidden divide-y">
            {filteredUsers.map((u) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium truncate">{u.full_name || u.email.split("@")[0]}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <button
                    onClick={() => toggleRole(u.id, u.role)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                      u.role === "admin"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-green-500/10 text-green-600 dark:text-green-400"
                    }`}
                  >
                    {u.role === "admin" ? <Shield className="h-3 w-3" /> : <Leaf className="h-3 w-3" />}
                    {u.role}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {u.role === "petani" && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => { setAssignUser(u); setAssignOwner(""); }}>
                      <Link2 className="h-3 w-3" /> Assign
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => { setNotifyUser(u); setNotifyForm({ title: "", message: "", type: "info" }); }}>
                    <Bell className="h-3 w-3" /> Notif
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {/* Show assigned owners for this petani */}
                {u.role === "petani" && (
                  <div className="flex flex-wrap gap-1">
                    {farmerOwners.filter(fo => fo.user_id === u.id).map(fo => (
                      <span key={fo.id} className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-0.5 rounded-full">
                        {fo.owner_name}
                        <button onClick={() => handleRemoveAssign(fo.id)} className="text-muted-foreground hover:text-destructive">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 text-left font-medium text-muted-foreground">Nama</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Owner Assigned</th>
                  <th className="p-3 text-left font-medium text-muted-foreground">Tanggal Daftar</th>
                  <th className="p-3 text-left font-medium text-muted-foreground w-40">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{u.full_name || "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">{u.email}</td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleRole(u.id, u.role)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 ${
                          u.role === "admin"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                            : "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                        }`}
                      >
                        {u.role === "admin" ? <Shield className="h-3 w-3" /> : <Leaf className="h-3 w-3" />}
                        {u.role}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {farmerOwners.filter(fo => fo.user_id === u.id).map(fo => (
                          <span key={fo.id} className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-0.5 rounded-full">
                            {fo.owner_name}
                            <button onClick={() => handleRemoveAssign(fo.id)} className="text-muted-foreground hover:text-destructive">×</button>
                          </span>
                        ))}
                        {u.role !== "petani" && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("id-ID")}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {u.role === "petani" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Assign Owner" onClick={() => { setAssignUser(u); setAssignOwner(""); }}>
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Kirim Notifikasi" onClick={() => { setNotifyUser(u); setNotifyForm({ title: "", message: "", type: "info" }); }}>
                          <Bell className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Hapus" onClick={() => setDeleteUser(u)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && !loadingUsers && (
            <div className="p-8 text-center text-sm text-muted-foreground">Tidak ada user ditemukan.</div>
          )}
        </div>

        {/* Dialog: Kirim Notifikasi */}
        <Dialog open={!!notifyUser} onOpenChange={(o) => !o && setNotifyUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kirim Notifikasi ke {notifyUser?.full_name || notifyUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Judul</Label>
                <Input value={notifyForm.title} onChange={e => setNotifyForm(p => ({ ...p, title: e.target.value }))} placeholder="Judul notifikasi" />
              </div>
              <div className="space-y-2">
                <Label>Pesan</Label>
                <Input value={notifyForm.message} onChange={e => setNotifyForm(p => ({ ...p, message: e.target.value }))} placeholder="Isi pesan" />
              </div>
              <div className="space-y-2">
                <Label>Tipe</Label>
                <Select value={notifyForm.type} onValueChange={v => setNotifyForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">ℹ️ Info</SelectItem>
                    <SelectItem value="success">✅ Sukses</SelectItem>
                    <SelectItem value="warning">⚠️ Peringatan</SelectItem>
                    <SelectItem value="danger">🚨 Bahaya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotifyUser(null)}>Batal</Button>
              <Button onClick={handleNotify} disabled={sending}>{sending ? "Mengirim..." : "Kirim Notifikasi"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Assign Owner */}
        <Dialog open={!!assignUser} onOpenChange={(o) => !o && setAssignUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Pemilik Latex ke {assignUser?.full_name || assignUser?.email}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pilih Pemilik Latex</Label>
                <Select value={assignOwner} onValueChange={setAssignOwner}>
                  <SelectTrigger><SelectValue placeholder="Pilih pemilik..." /></SelectTrigger>
                  <SelectContent>
                    {owners.filter(o => o && o.toLowerCase() !== "unknown").map(o => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground">
                Owner yang sudah di-assign:{" "}
                {farmerOwners.filter(fo => fo.user_id === assignUser?.id).map(fo => fo.owner_name).join(", ") || "Belum ada"}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignUser(null)}>Batal</Button>
              <Button onClick={handleAssign}>Assign</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Delete */}
        <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus user {deleteUser?.email}?</AlertDialogTitle>
              <AlertDialogDescription>Semua data terkait user ini akan dihapus permanen.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? "Menghapus..." : "Hapus User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
