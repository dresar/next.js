import { DashboardLayout } from "@/components/DashboardLayout";
import { useDevices } from "@/hooks/use-devices";
import { Wifi, Router, BatteryFull, BatteryLow, BatteryWarning, Clock, Cpu } from "lucide-react";

function batteryIcon(level: number | null) {
  if (level == null) return BatteryWarning;
  if (level >= 60) return BatteryFull;
  if (level >= 25) return BatteryLow;
  return BatteryWarning;
}

function batteryLabel(level: number | null) {
  if (level == null) return "—";
  return `${Number(level).toFixed(1)}%`;
}

export default function DeviceMonitoring() {
  const { devices, warnings, loading, offlineAfterSeconds } = useDevices();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Device Monitoring</h1>
          <p className="text-sm text-muted-foreground">
            Status perangkat ESP32 (offline jika tidak update &gt; {offlineAfterSeconds}s)
          </p>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">Peringatan Terbaru</h3>
            <div className="space-y-1 text-sm">
              {warnings.slice(0, 5).map((w, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-destructive font-medium">{w.device_id}: {w.status}</span>
                  <span className="text-xs text-muted-foreground">{new Date(w.at).toLocaleString("id-ID")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Memuat status perangkat...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left font-medium text-muted-foreground">Device</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Online</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">WiFi</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">MQTT</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Battery</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Firmware</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Update Terakhir</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden md:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => {
                    const Battery = batteryIcon(d.battery_level);
                    return (
                      <tr key={d.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-medium flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          {d.id}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-2 text-xs font-semibold px-2 py-1 rounded-full ${d.online ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                            <span className={`h-2 w-2 rounded-full ${d.online ? "bg-success" : "bg-muted-foreground/50"}`} />
                            {d.online ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Wifi className="h-3.5 w-3.5" />
                            {d.wifi_connected == null ? "—" : d.wifi_connected ? "Connected" : "Down"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-xs">
                            <Router className="h-3.5 w-3.5" />
                            {d.mqtt_connected == null ? "—" : d.mqtt_connected ? "Connected" : "Down"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-xs font-mono">
                            <Battery className="h-3.5 w-3.5" />
                            {batteryLabel(d.battery_level)}
                          </span>
                        </td>
                        <td className="p-3 hidden md:table-cell text-xs font-mono text-muted-foreground">{d.firmware_version ?? "—"}</td>
                        <td className="p-3 hidden sm:table-cell text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {d.last_seen ? new Date(d.last_seen).toLocaleString("id-ID") : "—"}
                          </span>
                        </td>
                        <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{d.last_status ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {devices.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">Belum ada perangkat.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

