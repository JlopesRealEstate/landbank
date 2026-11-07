"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { cn } from "@/components/ui";

export function PrintToolbar({ areaCode }: { areaCode: string }) {
  return (
    <div className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px] text-muted">
        <span className="rounded bg-[#0b2a35] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white">
          {areaCode}
        </span>
        Ficha completa em A4 retrato · fotos em mosaico · design do CRM
      </div>
      <div className="flex items-center gap-2">
        <Link href="/areas" className="rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-medium text-ink hover:border-leaf">
          Voltar
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8c2f43] px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-[#7a2739]"
        >
          <Printer className="h-3 w-3" /> Imprimir / Salvar PDF
        </button>
      </div>
    </div>
  );
}

const RAMP: { stop: number; color: [number, number, number] }[] = [
  { stop: 0, color: [28, 90, 107] },
  { stop: 0.32, color: [78, 132, 140] },
  { stop: 0.55, color: [150, 176, 158] },
  { stop: 0.74, color: [216, 196, 150] },
  { stop: 0.88, color: [196, 138, 96] },
  { stop: 1, color: [140, 47, 67] },
];

function rampColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let index = 1; index < RAMP.length; index += 1) {
    const previous = RAMP[index - 1];
    const current = RAMP[index];
    if (clamped <= current.stop) {
      const span = current.stop - previous.stop || 1;
      const local = (clamped - previous.stop) / span;
      const r = Math.round(previous.color[0] + (current.color[0] - previous.color[0]) * local);
      const g = Math.round(previous.color[1] + (current.color[1] - previous.color[1]) * local);
      const b = Math.round(previous.color[2] + (current.color[2] - previous.color[2]) * local);
      return `rgb(${r},${g},${b})`;
    }
  }
  return "rgb(140,47,67)";
}

/** Croqui técnico em SVG: perímetro KMZ, curvas de nível e mapa de calor — imprime com fidelidade. */
export function FichaMapSketch({
  geometry,
  contours = [],
  heatmap,
  snapshot,
  showHeatmap = true,
  showContours = true,
  contourScope = "both",
  restrictions = [],
}: {
  geometry: { coordinates: [number, number][] }[];
  contours?: { elevation: number; coordinates: [number, number][]; kind: string; inside?: boolean }[];
  heatmap?: { rows: number; cols: number; values: number[][]; bounds: { north: number; south: number; east: number; west: number }; min: number; max: number } | null;
  snapshot?: {
    width: number;
    height: number;
    zoom: number;
    basemap: string;
    tiles: { url: string; x: number; y: number; size: number }[];
    bounds: { north: number; south: number; east: number; west: number };
    attribution: string;
    available: boolean;
  } | null;
  showHeatmap?: boolean;
  showContours?: boolean;
  contourScope?: "both" | "inside" | "around";
  restrictions?: { id: number; type: string; label: string; coordinates: [number, number][] }[];
}) {
  const rings = geometry.filter((ring) => ring.coordinates.length > 2);
  if (!rings.length && !heatmap) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-line text-[10px] text-muted">
        Perímetro KMZ não cadastrado
      </div>
    );
  }

  const allPoints = rings.flatMap((ring) => ring.coordinates);
  const bound = snapshot?.bounds ?? heatmap?.bounds ?? null;
  const lngs = bound ? [bound.west, bound.east] : allPoints.map(([lng]) => lng);
  const lats = bound ? [bound.south, bound.north] : allPoints.map(([, lat]) => lat);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const width = 520;
  const height = 300;
  const pad = 8;
  const scaleX = (width - pad * 2) / (east - west || 1);
  const scaleY = (height - pad * 2) / (north - south || 1);
  const toX = (lng: number) => pad + (lng - west) * scaleX;
  const toY = (lat: number) => pad + (north - lat) * scaleY;

  const span = heatmap ? heatmap.max - heatmap.min || 1 : 1;
  const contourElevations = contours.map((contour) => contour.elevation);
  const minElevation = contourElevations.length ? Math.min(...contourElevations) : 0;
  const maxElevation = contourElevations.length ? Math.max(...contourElevations) : 1;
  const contourColor = (elevation: number, min: number, max: number) => {
    const ratio = Math.max(0, Math.min(1, (elevation - min) / (max - min || 1)));
    if (ratio < 0.25) return "#16a34a";
    if (ratio < 0.45) return "#65be2e";
    if (ratio < 0.65) return "#facc15";
    if (ratio < 0.82) return "#f99216";
    return "#ef4444";
  };

  if (snapshot?.available) {
    const visibleContours = contours.filter((contour) =>
      contourScope === "both" ? true : contourScope === "inside" ? contour.inside !== false : contour.inside === false,
    );
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-[#eef1ee]">
        <div className="relative w-full" style={{ aspectRatio: `${snapshot.width} / ${snapshot.height}` }}>
          {snapshot.tiles.map((tile, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${tile.x}-${tile.y}-${index}`}
              src={tile.url}
              alt=""
              style={{
                position: "absolute",
                left: `${(tile.x / snapshot.width) * 100}%`,
                top: `${(tile.y / snapshot.height) * 100}%`,
                width: `${(tile.size / snapshot.width) * 100}%`,
                height: `${(tile.size / snapshot.height) * 100}%`,
              }}
            />
          ))}
          <svg
            viewBox={`0 0 ${snapshot.width} ${snapshot.height}`}
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
          >
            {showHeatmap && heatmap
              ? heatmap.values.map((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    if (rowIndex === heatmap.rows - 1 || colIndex === heatmap.cols - 1) return null;
                    const cellWidth = (snapshot.bounds.east - snapshot.bounds.west) / (heatmap.cols - 1);
                    const cellHeight = (snapshot.bounds.north - snapshot.bounds.south) / (heatmap.rows - 1);
                    const lng = snapshot.bounds.west + colIndex * cellWidth;
                    const lat = snapshot.bounds.north - rowIndex * cellHeight;
                    const x = ((lng - snapshot.bounds.west) / (snapshot.bounds.east - snapshot.bounds.west)) * snapshot.width;
                    const y = ((snapshot.bounds.north - lat) / (snapshot.bounds.north - snapshot.bounds.south)) * snapshot.height;
                    return (
                      <rect
                        key={`h-${rowIndex}-${colIndex}`}
                        x={x}
                        y={y}
                        width={(Math.abs(cellWidth) / (snapshot.bounds.east - snapshot.bounds.west)) * snapshot.width + 1}
                        height={(Math.abs(cellHeight) / (snapshot.bounds.north - snapshot.bounds.south)) * snapshot.height + 1}
                        fill={rampColor((value - heatmap.min) / span)}
                        opacity={0.42}
                      />
                    );
                  }),
                )
              : null}

            {showContours
              ? visibleContours.map((contour, index) => (
                  <polyline
                    key={`sc-${index}-${contour.elevation}`}
                    points={contour.coordinates
                      .map(
                        ([lng, lat]) =>
                          `${((lng - snapshot.bounds.west) / (snapshot.bounds.east - snapshot.bounds.west)) * snapshot.width},${
                            ((snapshot.bounds.north - lat) / (snapshot.bounds.north - snapshot.bounds.south)) * snapshot.height
                          }`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke={contourColor(contour.elevation, minElevation, maxElevation)}
                    strokeWidth={contour.kind === "index" ? 1.8 : 0.9}
                    opacity={contour.inside === false ? 0.6 : 1}
                    strokeDasharray={contour.kind === "index" ? undefined : "3 2"}
                  />
                ))
              : null}

            {restrictions.map((restriction) => (
              <polygon
                key={`srest-${restriction.id}`}
                points={restriction.coordinates
                  .map(
                    ([lng, lat]) =>
                      `${((lng - snapshot.bounds.west) / (snapshot.bounds.east - snapshot.bounds.west)) * snapshot.width},${
                        ((snapshot.bounds.north - lat) / (snapshot.bounds.north - snapshot.bounds.south)) * snapshot.height
                      }`,
                  )
                  .join(" ")}
                fill="#84cc16"
                fillOpacity="0.42"
                stroke="#84cc16"
                strokeWidth="1.4"
                strokeDasharray="4 3"
              />
            ))}

            {rings.map((ring, index) => (
              <polygon
                key={`sr-${index}`}
                points={ring.coordinates
                  .map(
                    ([lng, lat]) =>
                      `${((lng - snapshot.bounds.west) / (snapshot.bounds.east - snapshot.bounds.west)) * snapshot.width},${
                        ((snapshot.bounds.north - lat) / (snapshot.bounds.north - snapshot.bounds.south)) * snapshot.height
                      }`,
                  )
                  .join(" ")}
                fill="none"
                stroke="#f0c623"
                strokeWidth="2.4"
              />
            ))}
          </svg>
        </div>
        <div className="flex items-center justify-between gap-2 bg-white px-1.5 py-1 text-[7px] text-muted">
          <span>
            Foto do mapa · {snapshot.basemap === "satelite" ? "satélite" : snapshot.basemap === "mapa" ? "mapa" : "humanitário"} ·
            zoom {snapshot.zoom} · {showContours ? "curvas de nível" : "sem curvas"}
            {showHeatmap ? " · mapa de calor" : ""} · perímetro KMZ
          </span>
          <span>{snapshot.attribution}</span>
        </div>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-lg border border-line bg-[#eef1ee]">
      {heatmap && showHeatmap
        ? heatmap.values.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              if (rowIndex === heatmap.rows - 1 || colIndex === heatmap.cols - 1) return null;
              const cellWidth = (east - west) / (heatmap.cols - 1);
              const cellHeight = (north - south) / (heatmap.rows - 1);
              const lng = west + colIndex * cellWidth;
              const lat = north - rowIndex * cellHeight;
              return (
                <rect
                  key={`${rowIndex}-${colIndex}`}
                  x={toX(lng)}
                  y={toY(lat)}
                  width={Math.abs(cellWidth * scaleX) + 0.6}
                  height={Math.abs(cellHeight * scaleY) + 0.6}
                  fill={rampColor((value - heatmap.min) / span)}
                  opacity={0.72}
                />
              );
            }),
          )
        : null}

      {(showContours ? contours : []).filter((contour) =>
        contourScope === "both" ? true : contourScope === "inside" ? contour.inside !== false : contour.inside === false,
      ).map((contour, index) => (
        <polyline
          key={`c-${index}-${contour.elevation}`}
          points={contour.coordinates.map(([lng, lat]) => `${toX(lng)},${toY(lat)}`).join(" ")}
          fill="none"
          stroke={contour.kind === "index" ? "#8c2f43" : "#154a58"}
          strokeWidth={contour.kind === "index" ? 1.1 : 0.6}
          opacity={contour.inside === false ? 0.45 : 0.95}
          strokeDasharray={contour.kind === "index" ? undefined : "2 2"}
        />
      ))}

      {rings.map((ring, index) => (
        <polygon
          key={`ring-${index}`}
          points={ring.coordinates.map(([lng, lat]) => `${toX(lng)},${toY(lat)}`).join(" ")}
          fill="none"
          stroke={snapshot?.available && snapshot.basemap === "satelite" ? "#ffffff" : "#1c5a6b"}
          strokeWidth="2.8"
        />
      ))}

      <text x={pad + 2} y={height - 4} fontSize="7" fill="#33474e">
        Perímetro KMZ · curvas de nível (bordô = mestras) · mapa de calor de cotas
      </text>
    </svg>
  );
}

export function PhotoMosaic({ photos }: { photos: { id: number; url: string; name: string; category: string }[] }) {
  if (!photos.length) {
    return (
      <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[10px] text-muted">
        Nenhuma foto cadastrada neste dossiê.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {photos.map((photo, index) => (
        <figure key={photo.id} className="mosaic-item overflow-hidden rounded-lg border border-line bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.name} className="h-[150px] w-full object-cover" />
          <figcaption className="flex items-center justify-between gap-1 px-1.5 py-1 text-[8px] text-muted">
            <span className="truncate">{photo.name}</span>
            <span className="shrink-0 uppercase tracking-[0.08em]">{String(index + 1).padStart(2, "0")}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function FichaContactBlock({ className, contact }: { className?: string; contact?: { name: string; phone: string; email: string } }) {
  const details = contact ?? { name: CONTACT.name, phone: CONTACT.phoneDisplay, email: CONTACT.email };
  return (
    <div className={cn("rounded-lg border border-line bg-paper/60 px-2.5 py-2 text-[9px] leading-relaxed text-ink-soft", className)}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Contato do usuário emissor</p>
      <p className="mt-0.5 text-[10px] font-semibold text-ink">{details.name} · Land Bank Corp</p>
      <p>{details.phone}</p>
      <p>{details.email}</p>
    </div>
  );
}
