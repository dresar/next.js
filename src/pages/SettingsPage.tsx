import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const SettingsPage = () => {
  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pengaturan Sistem</h1>
          <p className="text-sm text-muted-foreground">Konfigurasi sistem monitoring</p>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-6">
          <h3 className="text-sm font-semibold">Batas Ambang Sensor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>pH Minimum (Asam)</Label>
              <Input type="number" defaultValue="6" step="0.1" />
            </div>
            <div className="space-y-2">
              <Label>pH Maksimum (Basa)</Label>
              <Input type="number" defaultValue="9" step="0.1" />
            </div>
            <div className="space-y-2">
              <Label>TDS Minimum (ppm)</Label>
              <Input type="number" defaultValue="300" />
            </div>
            <div className="space-y-2">
              <Label>TDS Maksimum (ppm)</Label>
              <Input type="number" defaultValue="800" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">Notifikasi</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notifikasi Data Baru</p>
                <p className="text-xs text-muted-foreground">Terima pemberitahuan saat data baru masuk</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Peringatan Kualitas Rendah</p>
                <p className="text-xs text-muted-foreground">Terima peringatan saat kualitas lateks rendah</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Laporan Harian</p>
                <p className="text-xs text-muted-foreground">Kirim ringkasan data harian via email</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h3 className="text-sm font-semibold">Koneksi MQTT</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Broker URL</Label>
              <Input defaultValue="mqtt://broker.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Topik Subscribe</Label>
              <Input defaultValue="latex/sensor/data" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success pulse-dot" />
            <span className="text-xs text-muted-foreground">Terhubung</span>
          </div>
        </div>

        <Button>Simpan Pengaturan</Button>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
