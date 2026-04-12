import { FarmerLayout } from "@/components/FarmerLayout";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { getFarmerCache, prefetchAllFarmerData, type FarmerStats, type FarmerMeasurement } from "@/hooks/use-farmer-cache";
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Droplets, ShieldCheck, TrendingUp, TrendingDown, AlertTriangle, Activity, Minus } from "lucide-react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceLine, Legend
} from "recharts";
import { StatusBadge } from "@/components/StatusBadge";
import { statusToColor } from "@/lib/latex-utils";
import { useNavigate } from "react-router-dom";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

type ChartMode = "ph" | "tds" | "suhu";

// Custom crosshair tooltip – dark theme like trading platforms
function TradingTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  // Filter out Area duplicate (only show Line entries)
  const entries = payload.filter((p: any) => p.name && p.name !== p.dataKey);
  if (entries.length === 0 && payload.length > 0) {
    // Fallback: show the first entry if all are unnamed
    entries.push(payload[0]);
  }
  return (
    <div className="rounded-lg border border-border/60 bg-[#0d1117]/95 backdrop-blur-md px-3 py-2 shadow-2xl min-w-[160px]">
      <p className="text-[10px] text-muted-foreground font-mono mb-1.5 border-b border-border/30 pb-1">{label}</p>
      {entries.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.stroke }} />
            <span className="text-[11px] text-gray-300">{entry.name}</span>
          </span>
          <span className="text-[11px] font-mono font-semibold text-white">
            {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FarmerDashboard() {
  const { user } = useAuth();
  const { notifications } = useNotifications();
  const navigate = useNavigate();

  const cached = getFarmerCache();
  const [stats, setStats] = useState<FarmerStats | null>(cached?.stats ?? null);
  const [measurements, setMeasurements] = useState<FarmerMeasurement[]>(cached?.measurements ?? []);
  const [profileName, setProfileName] = useState(cached?.profile?.full_name ?? "");
  const [chartMode, setChartMode] = useState<ChartMode>("ph");

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    prefetchAllFarmerData().then((data) => {
      if (cancelled) return;
      setStats(data.stats);
      setMeasurements(data.measurements);
      setProfileName(data.profile.full_name ?? "");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Full historical data for trading chart — sorted oldest→newest
  const chartData = useMemo(() => {
    if (!measurements.length) return [];
    // Clone and reverse so oldest is first (measurements are DESC from API)
    return [...measurements].reverse().map((m) => {
      const d = new Date(m.created_at);
      return {
        time: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) + " " +
              d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        fullDate: d.toLocaleString("id-ID"),
        ph: m.ph_value != null ? Number(m.ph_value) : null,
        tds: m.tds_value,
        suhu: m.temperature,
        status: m.quality_status,
      };
    });
  }, [measurements]);

  // Compute current value & change for the selected metric
  const priceInfo = useMemo(() => {
    if (chartData.length < 1) return null;
    const last = chartData[chartData.length - 1];
    const prev = chartData.length >= 2 ? chartData[chartData.length - 2] : null;

    const current = chartMode === "ph" ? last.ph : chartMode === "tds" ? last.tds : last.suhu;
    const previous = prev ? (chartMode === "ph" ? prev.ph : chartMode === "tds" ? prev.tds : prev.suhu) : null;

    if (current == null) return null;

    const change = previous != null ? current - previous : 0;
    const changePercent = previous != null && previous !== 0 ? ((change / previous) * 100) : 0;
    const unit = chartMode === "ph" ? "" : chartMode === "tds" ? " ppm" : "°C";

    return { current, change, changePercent, unit };
  }, [chartData, chartMode]);

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

  // Chart color config per mode
  const chartConfig = useMemo(() => {
    switch (chartMode) {
      case "ph": return {
        stroke: "#22c55e",
        gradientStart: "rgba(34,197,94,0.35)",
        gradientEnd: "rgba(34,197,94,0)",
        label: "pH",
        dataKey: "ph" as const,
        domain: [4, 12] as [number, number],
        refLines: [
          { y: 7.5, label: "pH 7.5 (Batas Asam)", color: "#f59e0b" },
          { y: 8.8, label: "pH 8.8 (Batas Amonia)", color: "#ef4444" },
        ],
      };
      case "tds": return {
        stroke: "#3b82f6",
        gradientStart: "rgba(59,130,246,0.30)",
        gradientEnd: "rgba(59,130,246,0)",
        label: "TDS (ppm)",
        dataKey: "tds" as const,
        domain: ["auto", "auto"] as ["auto", "auto"],
        refLines: [
          { y: 500, label: "Kontaminasi (500)", color: "#f59e0b" },
          { y: 1100, label: "Oplos Air (1100)", color: "#ef4444" },
        ],
      };
      case "suhu": return {
        stroke: "#f97316",
        gradientStart: "rgba(249,115,22,0.30)",
        gradientEnd: "rgba(249,115,22,0)",
        label: "Suhu (°C)",
        dataKey: "suhu" as const,
        domain: ["auto", "auto"] as ["auto", "auto"],
        refLines: [],
      };
    }
  }, [chartMode]);

  // Initial brush position — show last 20 data points
  const brushStartIndex = Math.max(0, chartData.length - 20);

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

        {/* Alert Banner */}
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

        {/* ====== TRADING-STYLE CHART ====== */}
        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-xl border bg-card overflow-hidden"
          >
            {/* Chart Header — like a trading terminal */}
            <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 space-y-2">
              {/* Metric Tabs */}
              <div className="flex items-center gap-1">
                {([
                  { key: "ph" as ChartMode, label: "pH", icon: Droplets },
                  { key: "tds" as ChartMode, label: "TDS", icon: Activity },
                  { key: "suhu" as ChartMode, label: "Suhu", icon: Activity },
                ]).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setChartMode(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 ${
                      chartMode === tab.key
                        ? "bg-primary/15 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                  {chartData.length} data points
                </span>
              </div>

              {/* Current Value — big number like trading */}
              {priceInfo && (
                <div className="flex items-end gap-3">
                  <span className="text-2xl sm:text-3xl font-bold font-mono text-foreground tracking-tight">
                    {priceInfo.current.toFixed(2)}{priceInfo.unit}
                  </span>
                  <span className={`flex items-center gap-0.5 text-xs font-semibold font-mono pb-1 ${
                    priceInfo.change > 0 ? "text-green-500" : priceInfo.change < 0 ? "text-red-500" : "text-muted-foreground"
                  }`}>
                    {priceInfo.change > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : priceInfo.change < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    {priceInfo.change > 0 ? "+" : ""}
                    {priceInfo.change.toFixed(2)}
                    {" "}
                    ({priceInfo.changePercent > 0 ? "+" : ""}{priceInfo.changePercent.toFixed(2)}%)
                  </span>
                </div>
              )}
            </div>

            {/* Chart Body */}
            <div className="px-1 sm:px-2 pb-2">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tradingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartConfig.stroke} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartConfig.stroke} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    opacity={0.3}
                  />

                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                    minTickGap={40}
                  />

                  <YAxis
                    domain={chartConfig.domain}
                    tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />

                  <Tooltip content={<TradingTooltip />} cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "4 4" }} />

                  {/* Reference lines for quality thresholds */}
                  {chartConfig.refLines.map((ref, i) => (
                    <ReferenceLine
                      key={i}
                      y={ref.y}
                      stroke={ref.color}
                      strokeDasharray="6 4"
                      strokeWidth={1}
                      label={{
                        value: ref.label,
                        position: "insideTopRight",
                        style: { fontSize: 9, fill: ref.color, fontWeight: 500 },
                      }}
                    />
                  ))}

                  {/* Main Area (gradient fill only — hidden from tooltip/legend) */}
                  <Area
                    type="monotone"
                    dataKey={chartConfig.dataKey}
                    stroke="transparent"
                    fillOpacity={1}
                    fill="url(#tradingGradient)"
                    connectNulls
                    legendType="none"
                    tooltipType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey={chartConfig.dataKey}
                    stroke={chartConfig.stroke}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 5,
                      stroke: chartConfig.stroke,
                      strokeWidth: 2,
                      fill: "#0d1117",
                    }}
                    connectNulls
                    name={chartConfig.label}
                  />

                  {/* Brush — scrollbar to navigate through time (trading feature!) */}
                  <Brush
                    dataKey="time"
                    height={28}
                    stroke="hsl(var(--border))"
                    fill="hsl(var(--muted))"
                    travellerWidth={8}
                    startIndex={brushStartIndex}
                    tickFormatter={() => ""}
                  >
                    <ComposedChart>
                      <Area
                        type="monotone"
                        dataKey={chartConfig.dataKey}
                        stroke={chartConfig.stroke}
                        fill={chartConfig.stroke}
                        fillOpacity={0.15}
                        strokeWidth={1}
                        connectNulls
                      />
                    </ComposedChart>
                  </Brush>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Chart Footer — legend / info */}
            <div className="px-3 sm:px-4 pb-3 pt-1 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30">
              <span>📊 Geser slider di bawah chart untuk melihat data sebelumnya</span>
              <span className="font-mono">{chartData.length} pengukuran</span>
            </div>
          </motion.div>
        )}

        {/* Recent Measurements Table */}
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
