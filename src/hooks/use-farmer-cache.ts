/**
 * use-farmer-cache.ts
 * Global cache untuk semua data petani.
 * Semua data di-prefetch saat login sehingga halaman petani tampil INSTAN tanpa loading.
 */
import { createContext, useContext, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";

// ===== TYPES =====

export type FarmerProfile = {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  avatar_url?: string | null;
};

export type FarmerStats = {
  total_owners: number;
  total_measurements: number;
  avg_ph: number | null;
  latest_quality: string | null;
  measurements_this_month: number;
};

export type FarmerMeasurement = {
  id: string;
  owner_name: string;
  ph_value: number | null;
  tds_value: number;
  temperature: number;
  quality_status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  device_id: string | null;
};

export type OwnerAssignment = {
  id: string;
  owner_name: string;
  created_at: string;
};

export type FarmerCacheData = {
  profile: FarmerProfile;
  stats: FarmerStats;
  measurements: FarmerMeasurement[];
  myOwners: OwnerAssignment[];
  fetchedAt: number;
};

// ===== GLOBAL IN-MEMORY CACHE =====
// Ini disimpan di luar React agar persist antar navigasi halaman (single page app)

let _cache: FarmerCacheData | null = null;
let _loading = false;
let _fetchPromise: Promise<FarmerCacheData> | null = null;

/**
 * Prefetch semua data farmer sekaligus (dipanggil saat login).
 * Semua data diunduh dalam 1 batch parallel, lalu di-cache.
 */
export async function prefetchAllFarmerData(): Promise<FarmerCacheData> {
  // Kalau sudah loading, tunggu promise yang sama (deduplicate)
  if (_fetchPromise) return _fetchPromise;

  _loading = true;
  _fetchPromise = (async () => {
    try {
      // Step 1: Fetch profile dulu (butuh nama untuk filter measurements)
      const profile = await apiFetch<FarmerProfile>("/api/profile");
      const profileName = profile.full_name ?? "";

      // Step 2: Fetch sisanya secara PARALLEL
      const ownerParam = profileName ? `&owner=${encodeURIComponent(profileName)}` : "";
      const [stats, measurements, myOwners] = await Promise.all([
        apiFetch<FarmerStats>("/api/farmer/stats"),
        apiFetch<FarmerMeasurement[]>(`/api/measurements?limit=1000${ownerParam}`),
        apiFetch<OwnerAssignment[]>("/api/farmer/my-owners"),
      ]);

      const data: FarmerCacheData = {
        profile,
        stats,
        measurements: measurements.filter(m => m.owner_name !== "Unknown"),
        myOwners,
        fetchedAt: Date.now(),
      };

      _cache = data;
      return data;
    } finally {
      _loading = false;
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
}

/**
 * Ambil cache yang sudah ada. Return null jika belum ada.
 */
export function getFarmerCache(): FarmerCacheData | null {
  return _cache;
}

/**
 * Cek apakah cache sedang loading
 */
export function isFarmerCacheLoading(): boolean {
  return _loading;
}

/**
 * Hapus cache (dipanggil saat logout)
 */
export function clearFarmerCache(): void {
  _cache = null;
  _loading = false;
  _fetchPromise = null;
}

/**
 * Update partial cache (misal setelah edit profile)
 */
export function updateFarmerCache(partial: Partial<FarmerCacheData>): void {
  if (_cache) {
    _cache = { ..._cache, ...partial };
  }
}

/**
 * Force refresh measurement data saja (ringan, background)
 */
export async function refreshFarmerMeasurements(): Promise<void> {
  if (!_cache) return;
  const profileName = _cache.profile.full_name ?? "";
  const ownerParam = profileName ? `&owner=${encodeURIComponent(profileName)}` : "";
  try {
    const measurements = await apiFetch<FarmerMeasurement[]>(`/api/measurements?limit=1000${ownerParam}`);
    if (_cache) {
      _cache.measurements = measurements.filter(m => m.owner_name !== "Unknown");
    }
  } catch {
    // silent
  }
}

/**
 * Force refresh stats saja (background)
 */
export async function refreshFarmerStats(): Promise<void> {
  if (!_cache) return;
  try {
    const stats = await apiFetch<FarmerStats>("/api/farmer/stats");
    if (_cache) {
      _cache.stats = stats;
    }
  } catch {
    // silent
  }
}

// ===== REACT HOOK =====

/**
 * Hook untuk akses farmer cache dari komponen React.
 * Data langsung tersedia dari cache, TIDAK ADA loading state.
 */
export function useFarmerCache() {
  const cacheRef = useRef(_cache);
  // Selalu baca dari global cache terbaru
  cacheRef.current = _cache;

  const refresh = useCallback(async () => {
    await prefetchAllFarmerData();
  }, []);

  return {
    cache: _cache,
    isReady: _cache !== null,
    refresh,
  };
}
