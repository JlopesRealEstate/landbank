"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Globe2, Map as MapIcon, Satellite } from "lucide-react";
import type { GeoPolygon } from "@/db/schema";
import { BASEMAPS, type BasemapId } from "@/lib/map-types";
import { cn } from "@/components/ui";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas").then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#e7ebe2] text-xs text-muted">
      Carregando mapa…
    </div>
  ),
});

const ICONS = { mapa: MapIcon, satelite: Satellite, humanitario: Globe2 } as const;

export function MapPicker({
  lat,
  lng,
  geometry = [],
  onPick,
  height = 320,
}: {
  lat: number | null;
  lng: number | null;
  geometry?: GeoPolygon[];
  onPick: (point: { lat: number; lng: number }) => void;
  height?: number;
}) {
  const [basemap, setBasemap] = useState<BasemapId>("satelite");
  const valid = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0;

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-paper/70 px-2.5 py-1.5">
        <p className="text-[10px] text-muted">
          Clique no mapa para definir o ponto central · perímetro do KMZ é exibido em destaque
        </p>
        <div className="flex items-center rounded-md border border-line bg-white p-0.5">
          {(Object.keys(BASEMAPS) as BasemapId[]).map((key) => {
            const Icon = ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setBasemap(key)}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium",
                  basemap === key ? "bg-paper text-ink" : "text-muted hover:text-ink",
                )}
                title={BASEMAPS[key].note}
              >
                <Icon className="h-3 w-3" />
                {BASEMAPS[key].short}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ height }}>
        <MapCanvas
          areas={[]}
          basemap={basemap}
          onPick={onPick}
          pickPoint={valid ? { lat, lng } : null}
          previewGeometry={geometry}
          showPopup={false}
          initialZoom={valid ? 14 : 10}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
