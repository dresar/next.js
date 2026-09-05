export type LatexStatus =
  | "Mutu Prima"
  | "Mutu Rendah (Asam)"
  | "Terawetkan Amonia"
  | "Indikasi Oplos Air"
  | "Indikasi Kontaminasi"
  | "Tidak Ada Sampel";

export type StatusColor = "success" | "danger" | "warning" | "muted";

/**
 * Klasifikasi frontend menggunakan threshold PERSIS dari kode ESP32 (Program.cs BLOK 6):
 * - TDS ≤ 200 → Tidak Ada Sampel (probe di udara)
 * - pH ≤ 7.5  → Mutu Rendah (Asam)
 * - pH ≥ 8.8  → Terawetkan Amonia
 * - TDS ≤ 500 → Mutu Prima
 * - TDS ≤ 1100 → Indikasi Kontaminasi
 * - TDS > 1100 → Indikasi Oplos Air
 */
export function classifyLatex(ph: number | null, tds: number): { status: LatexStatus; color: StatusColor } {
  if (tds <= 200) return { status: "Tidak Ada Sampel", color: "muted" };
  if (ph != null && ph <= 7.5) return { status: "Mutu Rendah (Asam)", color: "danger" };
  if (ph != null && ph >= 8.8) return { status: "Terawetkan Amonia", color: "warning" };
  if (tds <= 500) return { status: "Mutu Prima", color: "success" };
  if (tds <= 1100) return { status: "Indikasi Kontaminasi", color: "warning" };
  return { status: "Indikasi Oplos Air", color: "warning" };
}

/**
 * Konversi nama status ke warna badge.
 * Mencakup semua 5 nilai mutu dari ESP32.
 */
export function statusToColor(status: string): StatusColor {
  const s = status.toLowerCase();
  if (s.includes("prima")) return "success";
  if (s.includes("asam") || s.includes("buruk") || s.includes("rendah")) return "danger";
  if (s.includes("amonia") || s.includes("awet") || s.includes("kontaminasi") || s.includes("oplos")) return "warning";
  return "muted";
}

export interface SensorData {
  id: string;
  ownerName: string;
  ph: number | null;
  tds: number;
  temperature: number;
  status: LatexStatus;
  statusColor: StatusColor;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
}
