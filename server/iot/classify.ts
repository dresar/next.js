export type QualityStatus =
  | "Mutu Prima"
  | "Mutu Rendah (Asam)"
  | "Terawetkan Amonia"
  | "Indikasi Oplos Air"
  | "Indikasi Kontaminasi"
  | "Tidak Ada Sampel";

/**
 * Klasifikasi kualitas lateks menggunakan threshold PERSIS dari algoritma ESP32:
 * - pH ≤ 7.5 → Buruk (Asam)         [BLOK 6, Evaluasi Lapis 1]
 * - pH ≥ 8.8 → Terawetkan Amonia    [BLOK 6, Evaluasi Lapis 1]
 * - TDS ≤ 500 → Prima               [BLOK 6, Evaluasi Lapis 2]
 * - TDS 501–1100 → Kontaminasi      [BLOK 6, Evaluasi Lapis 2]
 * - TDS > 1100 → Oplos Air          [BLOK 6, Evaluasi Lapis 2]
 */
export function classifyLatexQuality(params: { ph?: number | null; tds: number }): QualityStatus {
  const ph = params.ph ?? null;
  const tds = params.tds;

  // ESP32: isProbeImmersed = (dataTDS > 200)
  if (tds <= 200) return "Tidak Ada Sampel";

  // Evaluasi Lapis 1: pH
  if (ph != null) {
    if (ph <= 7.5) return "Mutu Rendah (Asam)";
    if (ph >= 8.8) return "Terawetkan Amonia";
  }

  // Evaluasi Lapis 2: TDS (pada rentang pH normal 7.6 – 8.7)
  if (tds <= 500) return "Mutu Prima";
  if (tds <= 1100) return "Indikasi Kontaminasi";
  return "Indikasi Oplos Air";
}

export type ProbeStatus = "liquid_detected" | "probe_dry" | "unknown";

/**
 * Turunkan status probe dari nilai mutu ESP32.
 * ESP32: isProbeImmersed = (dataTDS > 200)
 * Jika mutu = "TIDAK ADA SAMPEL" → probe kering.
 */
export function probeStatusFromMutu(qualityStatus: string | null | undefined): ProbeStatus {
  const s = (qualityStatus ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  if (s.includes("tidak ada sampel") || s === "probe_dry") return "probe_dry";
  return "liquid_detected";
}

/** Legacy compat — masih dipakai di beberapa tempat */
export function probeStatusFromDeviceStatus(deviceStatus: string | null | undefined): ProbeStatus {
  return probeStatusFromMutu(deviceStatus);
}
