import { DashboardLayout } from "@/components/DashboardLayout";
import { useMeasurements } from "@/hooks/use-measurements";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(152, 70%, 40%)", "hsl(0, 72%, 51%)", "hsl(38, 92%, 50%)", "hsl(200, 80%, 50%)", "hsl(280, 60%, 50%)"];

const AnalyticsPage = () => {
  const { data, loading } = useMeasurements();

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((d) => { counts[d.quality_status] = (counts[d.quality_status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace("Indikasi ", ""), value }));
  }, [data]);

  const phDistribution = useMemo(() => {
    const ranges = [
      { name: "< 5", count: 0 }, { name: "5-6", count: 0 }, { name: "6-7", count: 0 },
      { name: "7-8", count: 0 }, { name: "8-9", count: 0 }, { name: "> 9", count: 0 },
    ];
    data.forEach((d) => {
      const ph = d.ph_value;
      if (ph == null) return;
      if (ph < 5) ranges[0].count++;
      else if (ph < 6) ranges[1].count++;
      else if (ph < 7) ranges[2].count++;
      else if (ph < 8) ranges[3].count++;
      else if (ph < 9) ranges[4].count++;
      else ranges[5].count++;
    });
    return ranges;
  }, [data]);

  const phRows = useMemo(() => data.filter((d) => d.ph_value != null), [data]);
  const avgPh = phRows.length > 0 ? (phRows.reduce((a, b) => a + (b.ph_value ?? 0), 0) / phRows.length).toFixed(1) : "—";
  const primaCount = data.filter((d) => d.quality_status === "Mutu Prima").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Analitik Data</h1>
          <p className="text-sm text-muted-foreground">Ringkasan statistik pengukuran kualitas lateks</p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Pengukuran</p>
                <p className="text-3xl font-bold font-mono mt-2 text-card-foreground">{data.length}</p>
              </div>
              <div className="rounded-xl border bg-card p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Rata-rata pH</p>
                <p className="text-3xl font-bold font-mono mt-2 text-primary">{avgPh}</p>
              </div>
              <div className="rounded-xl border bg-card p-5 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Mutu Prima</p>
                <p className="text-3xl font-bold font-mono mt-2 text-success">{primaCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Distribusi Status</h3>
                {statusCounts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={statusCounts} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {statusCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Belum ada data</div>
                )}
              </div>

              <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-semibold mb-4">Distribusi pH</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={phDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--card-foreground))" }} />
                    <Bar dataKey="count" fill="hsl(168, 80%, 42%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
