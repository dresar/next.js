import { FarmerLayout } from "@/components/FarmerLayout";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { getFarmerCache, prefetchAllFarmerData, type FarmerStats, type FarmerMeasurement } from "@/hooks/use-farmer-cache";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Droplets, Waves, Thermometer, ShieldCheck, TrendingUp, AlertTriangle, Bell, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StatusBadge } from "@/components/StatusBadge";
import { classifyLatex, statusToColor } from "@/lib/latex-utils";
import { useNavigate } from "react-router-dom";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

export default function FarmerDashboard() {
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotifications();
  const navigate = useNavigate();

  // Ambil data dari cache global — sudah diprefetch saat login, TIDAK ADA loading
  const cached = getFarmerCache();
  const [stats, setStats] = useState<FarmerStats | null>(cached?.stats ?? null);
  const [measurements, setMeasurements] = useState<FarmerMeasurement[]>(cached?.measurements ?? []);
  const [profileName, setProfileName] = useState(cached?.profile?.full_name ?? "");

  // Fallback: jika cache belum ada (misalnya user refresh browser langsung ke /farmer),
  // fetch di background TANPA menampilkan loading spinner
  useEffect(() => {
    if (cached) return; // Sudah ada dari login prefetch

    let cancelled = false;
    prefetchAllFarmerData().then((data) => {
      if (cancelled) return;
      setStats(data.stats);
      setMeasurements(data.measurements);
      setProfileName(data.profile.full_name ?? "");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const chartData = useMemo(() => {
    if (!measurements.length) return [];
    return measurements.slice(0, 20).reverse().map((m) => ({
      time: new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      ph: m.ph_value ?? 0,
      tds: m.tds_value,
      suhu: m.temperature,
    }));
  }, [measurements]);

  const recentAlerts = useMemo(() => {
    return notifications.filter(n => n.type === "warning" || n.type === "danger").slice(0, 3);
  }, [notifications]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  }, []);

  // TIDAK ADA loading spinner — langsung tampilkan konten
  return (
    <FarmerLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Hero Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-green-500/5 p-4 sm:p-6"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary/15 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {profileName ? profileName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "PT"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-muted-foreground">{greeting} 👋</p>
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                {profileName || user?.email?.split("@")[0] || "Petani"}
              </h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {stats?.total_measurements ?? 0} total pengukuran • {stats?.measurements_this_month ?? 0} bulan ini
              </p>
            </div>
          </div>
        </motion.div>

        {/* Alert Banner — unread warnings */}
        {recentAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-4"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {recentAlerts.length} Peringatan Baru
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {recentAlerts[0]?.message}
                </p>
                <button
                  onClick={() => navigate("/farmer/notif")}
                  className="text-[11px] text-primary font-medium mt-1 hover:underline"
                >
                  Lihat semua →
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              title: "Pengukuran Bulan Ini",
              value: stats?.measurements_this_month ?? 0,
              icon: TrendingUp,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              title: "Rata-rata pH",
              value: stats?.avg_ph != null ? stats.avg_ph.toFixed(2) : "—",
              icon: Droplets,
              color: "text-green-500",
              bg: "bg-green-500/10",
            },
            {
              title: "Mutu Terakhir",
              value: stats?.latest_quality ?? "—",
              icon: ShieldCheck,
              color: stats?.latest_quality?.includes("Prima") ? "text-green-500" : "text-amber-500",
              bg: stats?.latest_quality?.includes("Prima") ? "bg-green-500/10" : "bg-amber-500/10",
              small: true,
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border bg-card p-3 sm:p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{card.title}</span>
                <div className={`h-7 w-7 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                </div>
              </div>
              <p className={`font-bold ${card.small ? "text-xs sm:text-sm" : "text-lg sm:text-2xl"} text-foreground`}>
                {card.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-xl border bg-card p-3 sm:p-4"
          >
            <h3 className="text-xs sm:text-sm font-semibold text-card-foreground mb-3">Tren pH & TDS (7 Hari Terakhir)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="fcPh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fcTds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(200, 80%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="time" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis yAxisId="ph" domain={[5, 11]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="tds" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(10,10,10,0.85)", backdropFilter: "blur(8px)", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: 11, color: "#fff" }}
                />
                <Area yAxisId="ph" type="monotone" dataKey="ph" stroke="hsl(142, 76%, 46%)" strokeWidth={2} fillOpacity={1} fill="url(#fcPh)" name="pH" />
                <Area yAxisId="tds" type="monotone" dataKey="tds" stroke="hsl(200, 80%, 55%)" strokeWidth={2} fillOpacity={1} fill="url(#fcTds)" name="TDS (ppm)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Recent Measurements Table (mobile = card, desktop = table) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="rounded-xl border bg-card overflow-hidden"
        >
          <div className="p-3 sm:p-4 border-b bg-muted/20 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-semibold text-card-foreground">Pengukuran Terbaru</h3>
            <button
              onClick={() => navigate("/farmer/data")}
              className="text-[11px] text-primary font-medium hover:underline"
            >
              Lihat Semua →
            </button>
          </div>

          {measurements.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Belum ada data pengukuran. Hubungi admin untuk mendapatkan akses.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden divide-y">
                {measurements.slice(0, 5).map((m) => (
                  <div key={m.id} className="p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="font-mono">pH: {m.ph_value != null ? Number(m.ph_value).toFixed(1) : "—"}</span>
                      <span className="font-mono">TDS: {m.tds_value}</span>
                      <span className="font-mono">{Number(m.temperature).toFixed(1)}°C</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/10">
                      <th className="p-3 text-left font-medium text-muted-foreground">#</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">pH</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">TDS</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Suhu</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Mutu</th>
                      <th className="p-3 text-left font-medium text-muted-foreground">Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.slice(0, 5).map((m, i) => (
                      <tr key={m.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-mono">{m.ph_value != null ? Number(m.ph_value).toFixed(2) : "—"}</td>
                        <td className="p-3 font-mono">{m.tds_value} ppm</td>
                        <td className="p-3 font-mono">{Number(m.temperature).toFixed(1)}°C</td>
                        <td className="p-3"><StatusBadge status={m.quality_status} color={statusToColor(m.quality_status)} /></td>
                        <td className="p-3 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </FarmerLayout>
  );
}
