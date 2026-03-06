export type QualityStatus =
  | "Mutu Prima"
  | "Mutu Rendah Asam"
  | "Terawetkan Amonia"
  | "Indikasi Oplos Air"
  | "Indikasi Kontaminasi";

export function classifyLatexQuality(params: { ph?: number | null; tds: number }): QualityStatus {
  const ph = params.ph ?? null;
  const tds = params.tds;

  // pH has priority when available
  if (ph != null) {
    if (ph <= 6) return "Mutu Rendah Asam";
    if (ph >= 9) return "Terawetkan Amonia";
  }

  if (tds <= 300) return "Indikasi Oplos Air";
  if (tds >= 800) return "Indikasi Kontaminasi";
  return "Mutu Prima";
}

export type ProbeStatus = "liquid_detected" | "probe_dry" | "unknown";

export function probeStatusFromDeviceStatus(deviceStatus: string | null | undefined): ProbeStatus {
  const s = (deviceStatus ?? "").toLowerCase();
  if (!s) return "unknown";
  if (s.includes("probe_dry")) return "probe_dry";
  if (s.includes("liquid")) return "liquid_detected";
  return "unknown";
}

