import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Moon, Sun, Home, BarChart3, BellDot, UserCircle, LogOut, Droplets, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { subscribeRealtime } from "@/lib/realtime";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { title: "Beranda", path: "/farmer", icon: Home },
  { title: "Data", path: "/farmer/data", icon: BarChart3 },
  { title: "Notifikasi", path: "/farmer/notif", icon: BellDot },
  { title: "Profil", path: "/farmer/profile", icon: UserCircle },
];

export function FarmerLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Profile name
  const [profileName, setProfileName] = useState<string>("");
  useEffect(() => {
    apiFetch<{ full_name: string | null }>("/api/profile")
      .then(p => setProfileName(p.full_name ?? ""))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Track device warnings via WS
  useEffect(() => {
    const unsub = subscribeRealtime((evt) => {
      if (evt.type === "device:warning") {
        const w = evt.data as { device_id?: unknown; status?: unknown };
        const deviceId = String(w.device_id ?? "").trim() || "unknown";
        toast.warning(`Peringatan perangkat ${deviceId}`);
      }
    });
    return () => unsub();
  }, []);

  const initials = profileName
    ? profileName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "PT";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Header */}
      <header className="h-14 flex items-center justify-between border-b border-border px-3 sm:px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          {!isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-muted-foreground hover:text-foreground">
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Droplets className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">LatexGuard</h1>
              <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">Dashboard Petani</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-muted-foreground hover:text-foreground h-8 w-8">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground h-8 w-8"
              onClick={() => navigate("/farmer/notif")}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          )}
          <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-semibold text-green-600 dark:text-green-400">
            {initials}
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <aside className="hidden lg:flex w-56 flex-col border-r bg-card/30 backdrop-blur-sm">
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                    {item.path === "/farmer/notif" && unreadCount > 0 && (
                      <span className="ml-auto h-5 min-w-[20px] rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center px-1">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Keluar
              </button>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`flex-1 overflow-auto ${isMobile ? "pb-20" : ""}`}>
          <div className="p-3 sm:p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-xl safe-area-bottom">
          <div className="flex items-center justify-around h-16 px-2">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 relative ${
                    active
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="bottomNavIndicator"
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    <item.icon className={`h-5 w-5 transition-all ${active ? "scale-110" : ""}`} />
                    {item.path === "/farmer/notif" && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground flex items-center justify-center px-0.5">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>{item.title}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
