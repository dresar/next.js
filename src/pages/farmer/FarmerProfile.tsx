import { FarmerLayout } from "@/components/FarmerLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserCircle, Leaf, MapPin, Phone, Mail, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";

type OwnerAssignment = {
  id: string;
  owner_name: string;
  created_at: string;
};

export default function FarmerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", phone: "", address: "" });
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [myOwners, setMyOwners] = useState<OwnerAssignment[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    Promise.all([
      apiFetch<{ full_name: string | null; phone: string | null; address: string | null }>("/api/profile"),
      apiFetch<OwnerAssignment[]>("/api/farmer/my-owners"),
    ]).then(([p, o]) => {
      if (cancelled) return;
      setProfile({
        full_name: p.full_name || "",
        phone: p.phone || "",
        address: p.address || "",
      });
      setMyOwners(o);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await apiFetch("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: profile.full_name || null,
          phone: profile.phone || null,
          address: profile.address || null,
        }),
      });
      toast.success("Profil berhasil disimpan!");

      if (newPassword) {
        await apiFetch("/api/profile/password", {
          method: "POST",
          body: JSON.stringify({ newPassword }),
        });
        toast.success("Password berhasil diubah!");
        setNewPassword("");
      }
    } catch (err) {
      const message = (err as { message?: string })?.message ?? "Gagal menyimpan";
      toast.error(message);
    }
    setLoading(false);
  };

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "PT";

  return (
    <FarmerLayout>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            Profil Saya
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Kelola informasi profil Anda</p>
        </div>

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border bg-card p-4 sm:p-6 space-y-5"
        >
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <span className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-base sm:text-lg truncate">{profile.full_name || "Petani"}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">{user?.email}</span>
              </div>
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                <Leaf className="h-3 w-3" />
                Petani
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Nama Lengkap</Label>
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={user?.email || ""} disabled className="opacity-60 h-9 text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> No. Telepon</Label>
              <Input
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Alamat</Label>
              <Input
                value={profile.address}
                onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-xs font-semibold flex items-center gap-1"><Lock className="h-3 w-3" /> Ubah Kata Sandi</h3>
            <div className="space-y-2">
              <Label className="text-xs">Kata Sandi Baru</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Kosongkan jika tidak ingin mengubah"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto h-9 text-sm">
            {loading ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </motion.div>

        {/* Assigned Owners */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border bg-card overflow-hidden"
        >
          <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
            <Leaf className="h-4 w-4 text-green-500" />
            <h3 className="text-sm font-semibold">Pemilik Latex Saya</h3>
            <span className="ml-auto text-xs text-muted-foreground">{myOwners.length} pemilik</span>
          </div>
          {myOwners.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Belum ada pemilik latex yang di-assign. Hubungi admin.
            </div>
          ) : (
            <div className="divide-y">
              {myOwners.map((o) => (
                <div key={o.id} className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{o.owner_name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    Sejak {new Date(o.created_at).toLocaleDateString("id-ID")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </FarmerLayout>
  );
}
