"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ImageOverlay,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { GeoPolygon, TerrainHeatmap } from "@/db/schema";
import { BASEMAPS, type BasemapId } from "@/lib/map-types";
import {
  contourGradientCss,
  elevationColor,
  RESTRICTION_COLOR,
  RESTRICTION_COLOR_DARK,
} from "@/lib/contour-colors";
import { brl, num } from "@/lib/format";

export type MapCanvasArea = {
  id: number;
  code: string;
  name: string;
  city: string;
  kind: string;
  status: string;
  lat: number;
  lng: number;
  landAreaM2: number;
  builtAreaM2: number;
  pricePerM2: number;
  totalPrice: number;
  transaction?: string;
  listingUrl?: string | null;
  score: number;
  coverUrl: string | null;
  geometry: GeoPolygon[];
};

type Props = {
  areas: MapCanvasArea[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  basemap: BasemapId;
  fitToAreas?: boolean;
  pickPoint?: { lat: number; lng: number } | null;
  onPick?: (point: { lat: number; lng: number }) => void;
  previewGeometry?: GeoPolygon[];
  contours?: { elevation: number; coordinates: [number, number][]; kind: string; inside?: boolean }[];
  showContours?: boolean;
  contourScope?: "both" | "inside" | "around";
  elevationRange?: { min: number; max: number } | null;
  heatmap?: TerrainHeatmap | null;
  cutFillHeatmap?: TerrainHeatmap | null;
  heatmapMode?: "elevation" | "cutfill";
  heatmapScope?: "both" | "inside" | "around";
  heatmapOpacity?: number;

  restrictions?: {
    id: number;
    type: string;
    label: string;
    coordinates: [number, number][];
    areaM2?: number;
    lossPct?: number;
  }[];
  fitSignal?: number;
  showPopup?: boolean;
  initialZoom?: number;
  onMove?: (view: { lat: number; lng: number; zoom: number }) => void;
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [-22.84, -47.2];

function pinIcon(area: MapCanvasArea, active: boolean) {
  const cls = `lbank-pin${area.kind === "galpao" ? " is-warehouse" : ""}${active ? " is-active" : ""}`;
  return L.divIcon({
    className: "lbank-marker",
    html: `<div class="${cls}"><span>${area.kind === "galpao" ? "G" : "T"}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
    popupAnchor: [0, -28],
  });
}

const pickerIcon = L.divIcon({
  className: "lbank-marker",
  html: '<div class="lbank-picker-pin"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const RAMP: { stop: number; color: [number, number, number] }[] = [
  { stop: 0, color: [28, 90, 107] },
  { stop: 0.32, color: [78, 132, 140] },
  { stop: 0.55, color: [150, 176, 158] },
  { stop: 0.74, color: [216, 196, 150] },
  { stop: 0.88, color: [196, 138, 96] },
  { stop: 1, color: [140, 47, 67] },
];

function rampColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i += 1) {
    const previous = RAMP[i - 1];
    const current = RAMP[i];
    if (clamped <= current.stop) {
      const span = current.stop - previous.stop || 1;
      const local = (clamped - previous.stop) / span;
      return [
        Math.round(previous.color[0] + (current.color[0] - previous.color[0]) * local),
        Math.round(previous.color[1] + (current.color[1] - previous.color[1]) * local),
        Math.round(previous.color[2] + (current.color[2] - previous.color[2]) * local),
      ];
    }
  }
  return RAMP[RAMP.length - 1].color;
}

/**
 * Gera a imagem do mapa de calor (interpolação bilinear) já recortada:
 * - inside: apenas o interior da demarcação do KMZ
 * - around: apenas o entorno (interior apagado)
 * - both: caixa completa estudada
 */
function buildHeatmapUrl(
  heatmap: TerrainHeatmap,
  ring: [number, number][] | null,
  scope: "both" | "inside" | "around",
  diverging = false,
): string | null {
  if (typeof document === "undefined") return null;
  const rows = heatmap.values.length;
  const cols = heatmap.values[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return null;

  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const image = context.createImageData(size, size);
  const span = heatmap.max - heatmap.min || 1;
  // escala divergente (corte/aterro): 0 m no centro da rampa
  const maxAbs = Math.max(Math.abs(heatmap.min), Math.abs(heatmap.max)) || 1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const gy = (y / (size - 1)) * (rows - 1);
      const gx = (x / (size - 1)) * (cols - 1);
      const y0 = Math.floor(gy);
      const x0 = Math.floor(gx);
      const y1 = Math.min(rows - 1, y0 + 1);
      const x1 = Math.min(cols - 1, x0 + 1);
      const fy = gy - y0;
      const fx = gx - x0;
      const value =
        heatmap.values[y0][x0] * (1 - fx) * (1 - fy) +
        heatmap.values[y0][x1] * fx * (1 - fy) +
        heatmap.values[y1][x0] * (1 - fx) * fy +
        heatmap.values[y1][x1] * fx * fy;
      const ratio = diverging ? (value + maxAbs) / (2 * maxAbs) : (value - heatmap.min) / span;
      const [r, g, b] = rampColor(ratio);
      const index = (y * size + x) * 4;
      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  if (ring && ring.length > 2 && scope !== "both") {
    const { north, south, east, west } = heatmap.bounds;
    const path = new Path2D();
    ring.forEach(([lng, lat], index) => {
      const px = ((lng - west) / (east - west || 1)) * size;
      const py = ((north - lat) / (north - south || 1)) * size;
      if (index === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    });
    path.closePath();
    if (scope === "inside") {
      context.globalCompositeOperation = "destination-in";
      context.fillStyle = "#fff";
      context.fill(path);
    } else {
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "#000";
      context.fill(path);
    }
    context.globalCompositeOperation = "source-over";
  }

  return canvas.toDataURL("image/png");
}

function MapController({
  areas,
  selectedId,
  fitToAreas,
  basemapKey,
  pickPoint,
  fitSignal,
  onMove,
}: {
  areas: MapCanvasArea[];
  selectedId?: number | null;
  fitToAreas: boolean;
  basemapKey: string;
  pickPoint?: { lat: number; lng: number } | null;
  fitSignal: number;
  onMove?: (view: { lat: number; lng: number; zoom: number }) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!onMove) return;
    const handler = () => {
      const center = map.getCenter();
      onMove({ lat: Number(center.lat.toFixed(6)), lng: Number(center.lng.toFixed(6)), zoom: map.getZoom() });
    };
    map.on("moveend", handler);
    handler();
    return () => {
      map.off("moveend", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 220);
    return () => clearTimeout(timeout);
  }, [map, basemapKey]);

  useEffect(() => {
    if (!fitToAreas) return;
    const single = areas.length === 1;
    const padding: [number, number] = single ? [26, 26] : [44, 44];
    const rings = areas.flatMap((area) => area.geometry.map((polygon) => polygon.coordinates));
    if (rings.length) {
      const bounds = L.latLngBounds(rings.flat().map(([lng, lat]) => L.latLng(lat, lng)));
      if (bounds.isValid()) {
        // área do KMZ ocupa a tela: padding mínimo e zoom alto para perímetros pequenos
        map.fitBounds(bounds, { padding, maxZoom: single ? 18 : 15 });
        map.setZoom(Math.min(map.getZoom(), single ? 17 : 15));
        return;
      }
    }
    if (areas.length > 1) {
      map.fitBounds(L.latLngBounds(areas.map((area) => L.latLng(area.lat, area.lng))), {
        padding: [48, 48],
        maxZoom: 13,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToAreas, areas.length, map, fitSignal]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = areas.find((area) => area.id === selectedId);
    if (!selected) return;
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, map]);

  useEffect(() => {
    if (!pickPoint || areas.length > 0) return;
    map.flyTo([pickPoint.lat, pickPoint.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickPoint?.lat, pickPoint?.lng, fitSignal]);

  return null;
}

/** Legenda do degradê semáforo das curvas (verde = cota baixa, vermelho = cota alta). */
function ContourLegend({ range, visible }: { range: { min: number; max: number }; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="leaflet-bottom leaflet-right"
      style={{ pointerEvents: "none", zIndex: 500 }}
    >
      <div
        className="leaflet-control"
        style={{
          margin: 10,
          background: "rgba(255,255,255,0.95)",
          border: "1px solid #ddd9d1",
          borderRadius: 8,
          padding: "4px 6px",
          fontSize: 9,
          lineHeight: 1.2,
          boxShadow: "0 2px 8px rgba(11,30,24,0.15)",
        }}
      >
        <div style={{ fontWeight: 700, color: "#33474e", marginBottom: 2 }}>Cotas (m)</div>
        <div
          style={{
            height: 7,
            width: 120,
            borderRadius: 4,
            background: contourGradientCss(),
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7a80", marginTop: 1 }}>
          <span>{range.min.toFixed(0)}</span>
          <span>{((range.min + range.max) / 2).toFixed(0)}</span>
          <span>{range.max.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );
}

function HeatmapLayer({
  heatmap,
  opacity,
  ring,
  scope,
  diverging,
}: {
  heatmap: TerrainHeatmap;
  opacity: number;
  ring: [number, number][] | null;
  scope: "both" | "inside" | "around";
  diverging: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(buildHeatmapUrl(heatmap, ring, scope, diverging));
  }, [heatmap, ring, scope, diverging]);
  if (!url) return null;
  return (
    <ImageOverlay
      url={url}
      bounds={[
        [heatmap.bounds.south, heatmap.bounds.west],
        [heatmap.bounds.north, heatmap.bounds.east],
      ]}
      opacity={opacity}
      zIndex={250}
      interactive={false}
    />
  );
}

function PickerEvents({ onPick }: { onPick?: (point: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(event) {
      if (!onPick) return;
      onPick({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

export function MapCanvas({
  areas,
  selectedId,
  onSelect,
  basemap,
  fitToAreas = false,
  pickPoint,
  onPick,
  previewGeometry = [],
  contours = [],
  showContours = true,
  contourScope = "both",
  elevationRange = null,
  heatmap = null,
  cutFillHeatmap = null,
  heatmapMode = "elevation",
  heatmapScope = "both",
  heatmapOpacity = 55,
  restrictions = [],
  fitSignal = 0,
  showPopup = true,
  initialZoom = 11,
  onMove,
  className,
}: Props) {
  const center = useMemo<[number, number]>(() => {
    if (pickPoint) return [pickPoint.lat, pickPoint.lng];
    if (areas.length === 1) return [areas[0].lat, areas[0].lng];
    return DEFAULT_CENTER;
  }, [pickPoint, areas]);

  const basemapConfig = BASEMAPS[basemap];
  const activeHeatmap = heatmapMode === "cutfill" ? cutFillHeatmap ?? heatmap : heatmap;
  /**
   * Cor da demarcação do KMZ: branca no satélite (melhor contraste sobre imagem)
   * e azul petróleo nos demais estilos. O preenchimento interno não muda.
   */
  const kmzStroke = basemap === "satelite" ? "#ffffff" : "#1c5a6b";
  const rampMin = elevationRange?.min ?? (contours.length ? Math.min(...contours.map((item) => item.elevation)) : 0);
  const rampMax = elevationRange?.max ?? (contours.length ? Math.max(...contours.map((item) => item.elevation)) : 1);

  return (
    <MapContainer
      center={center}
      zoom={areas.length === 1 ? 14 : initialZoom}
      scrollWheelZoom
      className={className ?? "h-full w-full"}
      attributionControl
      preferCanvas
    >
      <TileLayer key={basemap} url={basemapConfig.url} attribution={basemapConfig.attribution} maxZoom={basemapConfig.maxZoom} />
      <MapController
        areas={areas}
        selectedId={selectedId}
        fitToAreas={fitToAreas}
        basemapKey={basemap}
        pickPoint={pickPoint}
        fitSignal={fitSignal}
        onMove={onMove}
      />
      <PickerEvents onPick={onPick} />

      {areas.map((area) => {
        const active = area.id === selectedId;
        return (
          <Fragment key={area.id}>
            {area.geometry.map((polygon, index) => (
              <Polygon
                key={`${area.id}-${index}`}
                positions={polygon.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
                pathOptions={{
                  // satélite → branco; demais mapas → azul petróleo (interior inalterado)
                  color: kmzStroke,
                  weight: active ? 3.2 : 2.4,
                  opacity: 0.95,
                  fillColor: active ? "#a8465c" : "#1c5a6b",
                  fillOpacity: active ? 0.28 : 0.14,
                  dashArray: area.kind === "terreno" ? "6 4" : undefined,
                }}
                eventHandlers={{ click: () => onSelect?.(area.id) }}
              >
                {showPopup ? (
                  <Popup>
                    <div style={{ minWidth: 205 }}>
                      <strong>{area.name}</strong>
                      <div style={{ margin: "3px 0 4px", fontSize: 14, fontWeight: 800, color: "#8c2f43" }}>
                        {brl(area.totalPrice > 0 ? area.totalPrice : Math.round(area.pricePerM2 * area.landAreaM2))}
                      </div>
                      {area.code} · {area.city}
                      <br />
                      {num(area.landAreaM2)} m² de terreno · {brl(area.pricePerM2)}/m²
                      {area.listingUrl ? (
                        <div style={{ marginTop: 6 }}>
                          <a
                            href={area.listingUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: "inline-block",
                              background: "#0d2a22",
                              color: "#d7f36c",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              textDecoration: "none",
                            }}
                          >
                            Ver anúncio ↗
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </Popup>
                ) : null}
              </Polygon>
            ))}
            <Marker
              position={[area.lat, area.lng]}
              icon={pinIcon(area, active)}
              title={`${area.code} — ${area.name} — ${brl(
                area.totalPrice > 0 ? area.totalPrice : Math.round(area.pricePerM2 * area.landAreaM2),
              )}`}
              eventHandlers={{ click: () => onSelect?.(area.id) }}
              zIndexOffset={active ? 500 : 0}
            >
              <Tooltip direction="top" offset={[0, -30]} opacity={1} className="!text-[10px]">
                <strong>{area.code}</strong> · {brl(area.totalPrice > 0 ? area.totalPrice : Math.round(area.pricePerM2 * area.landAreaM2), { compact: true })}
              </Tooltip>
              {showPopup ? (
                <Popup>
                  <div style={{ minWidth: 210 }}>
                    <strong>{area.name}</strong>
                    <div
                      style={{
                        margin: "3px 0 4px",
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#8c2f43",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {brl(area.totalPrice > 0 ? area.totalPrice : Math.round(area.pricePerM2 * area.landAreaM2))}
                    </div>
                    {area.code} · {area.city} · Land Score {area.score}/100
                    <br />
                    {num(area.landAreaM2)} m²
                    {area.builtAreaM2 > 0 ? ` · ${num(area.builtAreaM2)} m² construídos` : ""}
                    <br />
                    <span style={{ color: "#6b7a80" }}>
                      {brl(area.pricePerM2)}/m² · {area.totalPrice > 0 ? "valor total" : "estimado (m² × área)"}
                    </span>
                    {area.listingUrl ? (
                      <div style={{ marginTop: 6 }}>
                        <a
                          href={area.listingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-block",
                            background: "#0d2a22",
                            color: "#d7f36c",
                            borderRadius: 6,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            textDecoration: "none",
                          }}
                        >
                          Ver anúncio ↗
                        </a>
                      </div>
                    ) : null}
                  </div>
                </Popup>
              ) : null}
            </Marker>
          </Fragment>
        );
      })}

      {activeHeatmap ? (
        <HeatmapLayer
          heatmap={activeHeatmap}
          opacity={heatmapOpacity / 100}
          scope={heatmapScope}
          diverging={heatmapMode === "cutfill"}
          ring={areas[0]?.geometry[0]?.coordinates ?? null}
        />
      ) : null}

      {restrictions.map((restriction) => (
        <Polygon
          key={`restriction-${restriction.id}`}
          positions={restriction.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
          pathOptions={{
            color: RESTRICTION_COLOR,
            weight: 3,
            fillColor: RESTRICTION_COLOR,
            fillOpacity: 0.34,
            dashArray: "9 5",
          }}
        >
          <Tooltip sticky className="!text-[10px]">
            <strong>{restriction.label}</strong>
            {restriction.areaM2
              ? ` — ${restriction.areaM2.toLocaleString("pt-BR")} m²${
                  restriction.lossPct !== undefined ? ` (${restriction.lossPct.toFixed(2)}% de perda)` : ""
                }`
              : " · restrição"}
          </Tooltip>
        </Polygon>
      ))}

      <ContourLegend range={{ min: rampMin, max: rampMax }} visible={showContours && contours.length > 0} />

      {showContours
        ? contours
            .filter((contour) =>
              contourScope === "both" ? true : contourScope === "inside" ? contour.inside !== false : contour.inside === false,
            )
            .map((contour, index) => (
              <Polyline
                key={`contour-${index}-${contour.elevation}-${contour.inside ? "in" : "out"}`}
                positions={contour.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
                pathOptions={{
                  color: elevationColor(contour.elevation, rampMin, rampMax),
                  weight: contour.kind === "index" ? (contour.inside ? 3.4 : 2.2) : contour.inside ? 1.9 : 1.1,
                  opacity: contour.inside ? 1 : 0.5,
                  dashArray: contour.kind === "index" ? undefined : "6 3",
                  lineCap: "round",
                }}
                interactive={contour.kind === "index"}
              >
                <Tooltip sticky className="!text-[10px]">
                  Cota {contour.elevation} m {contour.inside ? "· dentro do KMZ" : "· entorno"}
                </Tooltip>
              </Polyline>
            ))
          : null}

      {previewGeometry.map((polygon, index) => (
        <Polygon
          key={`preview-${index}`}
          positions={polygon.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
          pathOptions={{ color: kmzStroke, weight: 2.4, fillColor: "#a8465c", fillOpacity: 0.3, dashArray: "5 4" }}
        />
      ))}

      {pickPoint ? <Marker position={[pickPoint.lat, pickPoint.lng]} icon={pickerIcon} /> : null}
    </MapContainer>
  );
}
