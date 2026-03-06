import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MqttOwnerPopup } from "@/components/MqttOwnerPopup";
import { Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useEffect } from "react";
import { subscribeRealtime } from "@/lib/realtime";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    let offlineAfterSeconds = 60;
    const lastSeen = new Map<string, number>();
    const offlineNotified = new Set<string>();

    apiFetch<{ offline_after_seconds: number; devices: { id: string; last_seen: string | null }[] }>("/api/devices")
      .then((d) => {
        offlineAfterSeconds = d.offline_after_seconds;
        for (const dev of d.devices) {
          if (dev.last_seen) lastSeen.set(dev.id, new Date(dev.last_seen).getTime());
        }
      })
      .catch(() => {
        // ignore
      });

    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "device:warning") {
        const w = evt.data as any;
        toast.warning(`Peringatan perangkat ${w.device_id}: ${w.status}`);
      }
      if (evt.type === "device:status") {
        const d = evt.data as any;
        if (d.device_id) {
          lastSeen.set(d.device_id, Date.now());
          offlineNotified.delete(d.device_id);
        }
      }
      if (evt.type === "measurement:new") {
        const m = evt.data as any;
        if (m.device_id) {
          lastSeen.set(m.device_id, Date.now());
          offlineNotified.delete(m.device_id);
        }
      }
    });

    const t = window.setInterval(() => {
      const now = Date.now();
      for (const [id, ts] of lastSeen) {
        if ((now - ts) / 1000 > offlineAfterSeconds && !offlineNotified.has(id)) {
          offlineNotified.add(id);
          toast.error(`Perangkat ${id} offline (tidak ada data terbaru)`);
        }
      }
    }, 5000);

    return () => {
      window.clearInterval(t);
      unsub();
    };
  }, []);

  return (
    <SidebarProvider>
      <MqttOwnerPopup />
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-3 sm:px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="hidden sm:flex items-center gap-2 ml-2">
                <span className="h-2 w-2 rounded-full bg-success pulse-dot" />
                <span className="text-xs text-muted-foreground">Sensor Aktif</span>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                AD
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
