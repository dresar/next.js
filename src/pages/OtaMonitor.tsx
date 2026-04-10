import { DashboardLayout } from "@/components/DashboardLayout";
import { useDevices } from "@/hooks/use-devices";
import { DownloadCloud, Clock, Cpu } from "lucide-react";

export default function OtaMonitor() {
  const { devices, loading } = useDevices();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">OTA Monitor</h1>
          <p className="text-sm text-muted-foreground">Pantau versi firmware ESP32 dan update terakhir</p>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left font-medium text-muted-foreground">Device</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Firmware</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Update Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className="border-b border-border/30">
                      <td className="p-3 font-medium flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        {d.id}
                      </td>
                      <td className="p-3 text-xs font-mono">
                        <span className="inline-flex items-center gap-2">
                          <DownloadCloud className="h-4 w-4 text-muted-foreground" />
                          {d.firmware_version ?? "—"}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {d.last_seen ? new Date(d.last_seen).toLocaleString("id-ID") : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {devices.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">Belum ada perangkat.</div>
              )}
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

