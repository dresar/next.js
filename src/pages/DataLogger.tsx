import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollText, RefreshCw } from "lucide-react";
import { useDevices } from "@/hooks/use-devices";

type DeviceLog = {
  id: number;
  device_id: string | null;
  topic: string;
  payload: any;
  received_at: string;
  measurement_id: string | null;
};

export default function DataLogger() {
  const { devices } = useDevices();
  const [deviceId, setDeviceId] = useState<string>("all");
  const [limit, setLimit] = useState("200");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (deviceId !== "all") params.set("device_id", deviceId);
    params.set("limit", limit);
    const data = await apiFetch<DeviceLog[]>(`/api/device-logs?${params.toString()}`);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, limit]);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) => JSON.stringify(r.payload).toLowerCase().includes(s) || r.topic.toLowerCase().includes(s));
  }, [rows, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Data Logger</h1>
          <p className="text-sm text-muted-foreground">Log mentah data MQTT dari perangkat ESP32</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Device</SelectItem>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Limit (max 1000)" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari di payload/topic..." />
          <Button onClick={fetchLogs} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left font-medium text-muted-foreground">Waktu</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Device</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Topik</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/30 align-top">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.received_at).toLocaleString("id-ID")}</td>
                      <td className="p-3 text-xs font-mono">{r.device_id ?? "—"}</td>
                      <td className="p-3 text-xs font-mono">{r.topic}</td>
                      <td className="p-3 text-xs">
                        <pre className="whitespace-pre-wrap break-words max-w-[900px] bg-muted/20 rounded-md p-2 border">
                          {JSON.stringify(r.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <ScrollText className="h-4 w-4" /> Tidak ada log.
                </div>
              )}
            </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

