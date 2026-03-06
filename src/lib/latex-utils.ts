export type LatexStatus = 
  | "Mutu Prima"
  | "Mutu Rendah Asam"
  | "Terawetkan Amonia"
  | "Indikasi Oplos Air"
  | "Indikasi Kontaminasi";

export type StatusColor = "success" | "danger" | "warning";

export function classifyLatex(ph: number, tds: number): { status: LatexStatus; color: StatusColor } {
  if (ph <= 6) return { status: "Mutu Rendah Asam", color: "danger" };
  if (ph >= 9) return { status: "Terawetkan Amonia", color: "warning" };
  if (tds <= 300) return { status: "Indikasi Oplos Air", color: "warning" };
  if (tds >= 800) return { status: "Indikasi Kontaminasi", color: "warning" };
  return { status: "Mutu Prima", color: "success" };
}

export interface SensorData {
  id: string;
  ownerName: string;
  ph: number;
  tds: number;
  temperature: number;
  status: LatexStatus;
  statusColor: StatusColor;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export function generateMockData(count: number = 20): SensorData[] {
  const owners = ["Ahmad Sutisna", "Budi Hartono", "Citra Dewi", "Darmawan", "Eka Prasetya", "Fitri Handayani"];
  const data: SensorData[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const ph = +(Math.random() * 6 + 4).toFixed(1);
    const tds = Math.round(Math.random() * 1000 + 100);
    const temp = +(Math.random() * 10 + 25).toFixed(1);
    const { status, color } = classifyLatex(ph, tds);

    data.push({
      id: `m-${i + 1}`,
      ownerName: owners[Math.floor(Math.random() * owners.length)],
      ph,
      tds,
      temperature: temp,
      status,
      statusColor: color,
      latitude: -(1.5 + Math.random() * 5),
      longitude: 103 + Math.random() * 10,
      timestamp: new Date(now - i * 3600000 * Math.random() * 24).toISOString(),
    });
  }
  return data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateTimeSeriesData(hours: number = 24) {
  const data = [];
  const now = Date.now();
  for (let i = hours; i >= 0; i--) {
    data.push({
      time: new Date(now - i * 3600000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      ph: +(6.5 + Math.sin(i / 4) * 1.5 + Math.random() * 0.5).toFixed(1),
      tds: Math.round(400 + Math.cos(i / 3) * 200 + Math.random() * 50),
      temperature: +(28 + Math.sin(i / 6) * 3 + Math.random()).toFixed(1),
    });
  }
  return data;
}
