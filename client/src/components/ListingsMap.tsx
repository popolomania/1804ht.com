import { useEffect, useRef } from "react";
import type { Listing } from "@shared/schema";
import { formatPrice, getPropertyTypeLabel } from "@/lib/utils";

// Department centroids for listings without lat/lng
const DEPT_COORDS: Record<string, [number, number]> = {
  "Ouest":      [18.5466, -72.3388],
  "Nord":       [19.7567, -72.2045],
  "Nord-Est":   [19.5567, -71.8500],
  "Nord-Ouest": [19.8400, -72.8300],
  "Artibonite": [19.1100, -72.6900],
  "Centre":     [19.0800, -71.8600],
  "Sud":        [18.2000, -73.7500],
  "Sud-Est":    [18.2330, -72.5367],
  "Grand-Anse": [18.5400, -74.1200],
  "Nippes":     [18.3900, -73.4200],
};

// Spread pins within a department so they don't all stack
function jitter(coord: [number, number], index: number, total: number): [number, number] {
  const angle = (index / Math.max(total, 1)) * 2 * Math.PI;
  const radius = Math.min(0.08, 0.02 * Math.sqrt(total));
  return [
    coord[0] + Math.sin(angle) * radius,
    coord[1] + Math.cos(angle) * radius,
  ];
}

// Color by property type
const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
  villa:      { bg: "#f59e0b", border: "#d97706" },
  house:      { bg: "#3b82f6", border: "#2563eb" },
  apartment:  { bg: "#8b5cf6", border: "#7c3aed" },
  land:       { bg: "#10b981", border: "#059669" },
  commercial: { bg: "#f97316", border: "#ea580c" },
};

function makePinSvg(color: string, border: string, label: string): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48">
      <filter id="shadow" x="-20%" y="-10%" width="150%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
      <path filter="url(#shadow)"
        d="M18 2C10.27 2 4 8.27 4 16c0 10.5 14 28 14 28S32 26.5 32 16C32 8.27 25.73 2 18 2z"
        fill="${color}" stroke="${border}" stroke-width="1.5"/>
      <circle cx="18" cy="16" r="8" fill="white" opacity="0.95"/>
      <text x="18" y="20" text-anchor="middle" font-size="9" font-weight="700" fill="${border}" font-family="sans-serif">${label}</text>
    </svg>
  `.trim();
}

interface Props {
  listings: Listing[];
  onListingClick: (id: number) => void;
}

export default function ListingsMap({ listings, onListingClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import Leaflet (avoids SSR issues)
    let L: any;
    let mounted = true;

    (async () => {
      const leaflet = await import("leaflet");
      L = leaflet.default;

      if (!mounted || !containerRef.current) return;

      // Destroy existing map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      // Init map centered on Haiti
      const map = L.map(containerRef.current, {
        center: [18.97, -72.29],
        zoom: 8,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      // Tile layer — CartoDB Positron (clean, light)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      // Group listings by department for jitter
      const byDept: Record<string, Listing[]> = {};
      for (const l of listings) {
        if (!byDept[l.department]) byDept[l.department] = [];
        byDept[l.department].push(l);
      }

      // Place markers
      markersRef.current = [];
      for (const dept of Object.keys(byDept)) {
        const group = byDept[dept];
        const base = DEPT_COORDS[dept] ?? [18.97, -72.29];

        group.forEach((listing, i) => {
          // Use actual coords if available, otherwise jitter from dept centroid
          const rawCoord: [number, number] =
            listing.lat && listing.lng
              ? [listing.lat, listing.lng]
              : base;

          const coord = (listing.lat && listing.lng)
            ? rawCoord
            : jitter(base, i, group.length);

          const tc = TYPE_COLORS[listing.propertyType] ?? { bg: "#64748b", border: "#475569" };
          const typeAbbr: Record<string, string> = {
            villa: "VL", house: "MN", apartment: "AP", land: "TR", commercial: "CO"
          };
          const abbr = typeAbbr[listing.propertyType] ?? "??";

          const svgStr = makePinSvg(tc.bg, tc.border, abbr);
          const icon = L.divIcon({
            html: svgStr,
            className: "",
            iconSize: [36, 48],
            iconAnchor: [18, 48],
            popupAnchor: [0, -46],
          });

          const images: string[] = JSON.parse(listing.images || "[]");
          const img = images[0] ?? "";
          const price = formatPrice(listing.price, listing.priceType);
          const ptLabel = getPropertyTypeLabel(listing.propertyType);
          const typeColor = listing.priceType === "rent" ? "#f97316" : "#0d7c84";
          const typeBadge = listing.priceType === "rent" ? "À Louer" : "À Vendre";

          const popup = L.popup({ maxWidth: 220, className: "kaye-popup" }).setContent(`
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; width: 200px;">
              ${img ? `<img src="${img}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px 6px 0 0;display:block;margin:-12px -12px 8px -12px;width:calc(100% + 24px);" />` : ""}
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
                <span style="background:${typeColor};color:white;font-size:10px;font-weight:600;padding:2px 7px;border-radius:99px;">${typeBadge}</span>
                <span style="background:#f1f5f9;color:#475569;font-size:10px;padding:2px 7px;border-radius:99px;">${ptLabel}</span>
              </div>
              <div style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.3;margin-bottom:3px;">${listing.title}</div>
              <div style="font-size:11px;color:#64748b;margin-bottom:6px;">📍 ${listing.city}, ${listing.department}</div>
              <div style="font-size:15px;font-weight:800;color:#0d7c84;margin-bottom:8px;">${price}</div>
              <button
                onclick="window.__kayeMapClick(${listing.id})"
                style="width:100%;background:#0d7c84;color:white;border:none;border-radius:6px;padding:7px 0;font-size:12px;font-weight:600;cursor:pointer;"
              >
                Voir l'annonce →
              </button>
            </div>
          `);

          const marker = L.marker(coord, { icon }).bindPopup(popup);
          marker.addTo(map);
          markersRef.current.push(marker);
        });
      }

      // Global click handler for popup buttons
      (window as any).__kayeMapClick = (id: number) => {
        onListingClick(id);
      };
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [listings]);

  // Inject Leaflet CSS once
  useEffect(() => {
    if (document.getElementById("leaflet-css")) return;
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-zinc-900 border rounded-lg p-3 shadow-md text-xs space-y-1.5">
        <div className="font-semibold text-xs mb-2 text-muted-foreground uppercase tracking-wide">Légende</div>
        {[
          { type: "villa",      label: "Villa",       abbr: "VL" },
          { type: "house",      label: "Maison",      abbr: "MN" },
          { type: "apartment",  label: "Appartement", abbr: "AP" },
          { type: "land",       label: "Terrain",     abbr: "TR" },
          { type: "commercial", label: "Commercial",  abbr: "CO" },
        ].map(({ type, label, abbr }) => {
          const c = TYPE_COLORS[type];
          return (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                style={{ background: c.bg, fontSize: "7px" }}
              >
                {abbr}
              </div>
              <span className="text-foreground">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Count badge */}
      <div className="absolute top-4 right-4 z-[1000] bg-white dark:bg-zinc-900 border rounded-full px-3 py-1 shadow text-xs font-semibold">
        {listings.length} propriété{listings.length !== 1 ? "s" : ""}
      </div>

      <style>{`
        .kaye-popup .leaflet-popup-content-wrapper {
          border-radius: 10px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .kaye-popup .leaflet-popup-content {
          margin: 12px;
        }
        .kaye-popup .leaflet-popup-tip-container {
          margin-top: -1px;
        }
      `}</style>
    </div>
  );
}
