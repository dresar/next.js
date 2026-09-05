import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserCircle, Camera } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", phone: "", address: "" });
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    apiFetch<{ full_name: string | null; phone: string | null; address: string | null }>("/api/profile")
      .then((data) => {
        if (cancelled) return;
        setProfile({
          full_name: data.full_name || "",
          phone: data.phone || "",
          address: data.address || "",
        });
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
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

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Profil Pengguna</h1>
          <p className="text-sm text-muted-foreground">Kelola informasi profil Anda</p>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <UserCircle className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div>
              <p className="font-semibold">{profile.full_name || "Pengguna"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Lengkap</Label>
              <Input value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={user?.email || ""} disabled className="opacity-70" />
            </div>
            <div className="space-y-2">
              <Label>Nomor Telepon</Label>
              <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Alamat</Label>
              <Input value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="text-sm font-semibold">Ubah Kata Sandi</h3>
            <div className="space-y-2">
              <Label>Kata Sandi Baru</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Kosongkan jika tidak ingin mengubah" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
