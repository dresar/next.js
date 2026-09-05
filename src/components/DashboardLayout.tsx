import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useEffect, useState, useRef } from "react";
import { subscribeRealtime } from "@/lib/realtime";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { MqttOwnerPopup } from "@/components/MqttOwnerPopup";
import { useNavigate } from "react-router-dom";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { unreadCount, notifications } = useNotifications();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
        const w = evt.data as { device_id?: unknown; status?: unknown };
        const deviceId = String(w.device_id ?? "").trim() || "unknown";
        const status = String(w.status ?? "").trim() || "warning";
        toast.warning(`Peringatan perangkat ${deviceId}: ${status}`);
      }
      if (evt.type === "device:status") {
        const d = evt.data as { device_id?: unknown };
        const deviceId = String(d.device_id ?? "").trim();
        if (deviceId) {
          lastSeen.set(deviceId, Date.now());
          offlineNotified.delete(deviceId);
        }
      }
      // Track last-seen dari data realtime MQTT maupun data yang sudah tersimpan
      if (evt.type === "measurement:new" || evt.type === "measurement:realtime") {
        const m = evt.data as { device_id?: unknown };
        const deviceId = String(m.device_id ?? "").trim();
        if (deviceId) {
          lastSeen.set(deviceId, Date.now());
          offlineNotified.delete(deviceId);
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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "AD";

  return (
    <SidebarProvider>
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

              {/* Notification Bell with Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-muted-foreground"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute right-0 top-10 w-72 sm:w-80 rounded-xl border bg-card shadow-xl z-50 overflow-hidden animate-fade-in">
                    <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
                      <span className="text-xs font-semibold">Notifikasi</span>
                      <span className="text-[10px] text-muted-foreground">{unreadCount} belum dibaca</span>
                    </div>
                    <div className="max-h-64 overflow-auto divide-y">
                      {notifications.slice(0, 5).map(n => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs space-y-0.5 ${n.is_read ? "" : "bg-primary/5"}`}
                        >
                          <p className="font-semibold text-foreground truncate">{n.title}</p>
                          <p className="text-muted-foreground line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/50">{new Date(n.created_at).toLocaleString("id-ID")}</p>
                        </div>
                      ))}
                      {notifications.length === 0 && (
                        <div className="p-4 text-xs text-muted-foreground text-center">Belum ada notifikasi</div>
                      )}
                    </div>
                    <div className="p-2 border-t bg-muted/10">
                      <button
                        onClick={() => { setShowDropdown(false); navigate("/admin/notifications"); }}
                        className="w-full text-center text-xs text-primary font-medium py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                      >
                        Lihat Semua Notifikasi
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                {initials}
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
      {/* Modal popup saat data MQTT/ESP32 baru diterima */}
      <MqttOwnerPopup />
    </SidebarProvider>
  );
}
