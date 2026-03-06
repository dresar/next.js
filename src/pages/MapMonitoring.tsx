import { DashboardLayout } from "@/components/DashboardLayout";
import { useMeasurements } from "@/hooks/use-measurements";
import { classifyLatex, type StatusColor } from "@/lib/latex-utils";
import { StatusBadge } from "@/components/StatusBadge";
import { MapPin } from "lucide-react";
import { useMemo, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

function statusToColor(status: string): StatusColor {
  if (status === "Mutu Prima") return "success";
  if (status === "Mutu Rendah Asam") return "danger";
  return "warning";
}

const createIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36], className: "custom-marker" });
};

const markerIcons = {
  success: createIcon("#22c55e"),
  warning: createIcon("#eab308"),
  danger: createIcon("#ef4444"),
};

function FitBounds({ data }: { data: { latitude: number | null; longitude: number | null }[] }) {
  const map = useMap();
  useEffect(() => {
    const valid = data.filter((d) => d.latitude && d.longitude);
    if (valid.length > 0) {
      const bounds = L.latLngBounds(valid.map((d) => [d.latitude!, d.longitude!]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }, [data, map]);
  return null;
}

const MapMonitoring = () => {
  const { data, loading } = useMeasurements();
  const mapData = useMemo(() => data.filter((d) => d.latitude && d.longitude), [data]);

  const center: [number, number] = useMemo(() => {
    if (mapData.length === 0) return [-2.5, 108];
    const avgLat = mapData.reduce((a, d) => a + d.latitude!, 0) / mapData.length;
    const avgLng = mapData.reduce((a, d) => a + d.longitude!, 0) / mapData.length;
    return [avgLat, avgLng];
  }, [mapData]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Peta Monitoring</h1>
          <p className="text-sm text-muted-foreground">Sebaran lokasi pengukuran kualitas lateks ({mapData.length} titik)</p>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="h-[350px] sm:h-[450px] lg:h-[500px]">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Memuat peta...</div>
            ) : (
              <MapContainer center={center} zoom={7} style={{ height: "100%", width: "100%" }} className="z-10">
                <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                <FitBounds data={mapData} />
                {mapData.map((d) => {
                  const color = statusToColor(d.quality_status);
                  return (
                    <Marker key={d.id} position={[d.latitude!, d.longitude!]} icon={markerIcons[color]}>
                      <Popup>
                        <div className="text-xs space-y-1 min-w-[160px]">
                          <p className="font-bold text-sm">{d.owner_name}</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                            <span className="text-gray-500">pH:</span><span className="font-mono font-semibold">{d.ph_value}</span>
                            <span className="text-gray-500">TDS:</span><span className="font-mono font-semibold">{d.tds_value} ppm</span>
                            <span className="text-gray-500">Suhu:</span><span className="font-mono font-semibold">{d.temperature}°C</span>
                          </div>
                          <div className="pt-1 border-t mt-1">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              color === "success" ? "bg-green-100 text-green-800" :
                              color === "warning" ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }`}>{d.quality_status}</span>
                          </div>
                          <p className="text-gray-400 text-[10px]">{new Date(d.created_at).toLocaleString("id-ID")}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            )}
          </div>
        </div>

        {mapData.length === 0 && !loading && (
          <div className="text-center py-4 text-muted-foreground text-sm">Belum ada data dengan koordinat lokasi.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mapData.slice(0, 6).map((d) => (
            <div key={d.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{d.owner_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />{d.latitude != null ? Number(d.latitude).toFixed(4) : "—"}, {d.longitude != null ? Number(d.longitude).toFixed(4) : "—"}
                  </p>
                </div>
                <StatusBadge status={d.quality_status} color={statusToColor(d.quality_status)} />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                <span>pH: {d.ph_value}</span>
                <span>TDS: {d.tds_value}</span>
                <span>{d.temperature}°C</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MapMonitoring;
