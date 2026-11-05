"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { Maximize2, Minimize2 } from "lucide-react";

/**
 * Corrige o dimensionamento do Leaflet quando o mapa é montado/revelado dentro
 * de um container oculto (painel recolhido) ou em tela cheia.
 */
function MapResizer({ signal }: { signal: number }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    let lastWidth = 0;
    let lastHeight = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      map.invalidateSize({ animate: false });
    };

    // dimensions may settle after mount (aba, tela cheia, painel recolhido)
    const first = setTimeout(invalidate, 80);
    const second = setTimeout(invalidate, 320);

    // observa o container com debounce e só reage a mudanças reais de tamanho,
    // evitando o loop ResizeObserver → invalidateSize → ResizeObserver
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(invalidate, 160);
    });
    observer.observe(container);

    return () => {
      clearTimeout(first);
      clearTimeout(second);
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
  }, [map, signal]);
  return null;
}

const CENTER: [number, number] = [-22.82, -47.27];

export type RestrictionShape = {
  id: number;
  type: string;
  label: string;
  coordinates: [number, number][];
  areaM2: number;
  lossPct: number;
};

import { RESTRICTION_COLOR, RESTRICTION_COLOR_DARK } from "@/lib/contour-colors";
import { BASEMAPS, type BasemapId } from "@/lib/map-types";

const TYPE_COLORS: Record<string, string> = {
  app: RESTRICTION_COLOR,
  nascente: RESTRICTION_COLOR,
  linhao: RESTRICTION_COLOR,
  duto: RESTRICTION_COLOR,
  faixa_estrada: RESTRICTION_COLOR,
  reserva_legal: RESTRICTION_COLOR,
  alagado: RESTRICTION_COLOR,
  outro: RESTRICTION_COLOR,
};

const TYPE_LABELS: Record<string, string> = {
  app: "APP",
  nascente: "Nascente",
  linhao: "Linhão",
  duto: "Duto",
  faixa_estrada: "Faixa de domínio",
  reserva_legal: "Reserva legal",
  alagado: "Alagado",
  outro: "Restrição",
};

const formatArea = (m2: number) =>
  m2 >= 10000
    ? `${(m2 / 10000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`
    : `${Math.round(m2).toLocaleString("pt-BR")} m²`;

/** Enquadra o mapa no perímetro do imóvel (e nas demarcações já salvas). */
function FitBounds({
  pointsKey,
  signal,
}: {
  /** chave estável (string) — evita reenquadrar o mapa a cada render */
  pointsKey: string;
  signal: number;
}) {
  const map = useMap();
  const lastKey = useRef("");
  const lastSignal = useRef(-1);

  useEffect(() => {
    if (lastKey.current === pointsKey && lastSignal.current === signal) return;
    lastKey.current = pointsKey;
    lastSignal.current = signal;
    const points = pointsKey
      .split(";")
      .map((pair) => pair.split(",").map(Number))
      .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
      .map(([lat, lng]) => [lat, lng] as [number, number]);
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    if (!bounds.isValid()) return;
    const timeout = setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18 });
    }, 120);
    return () => clearTimeout(timeout);
  }, [map, pointsKey, signal]);
  return null;
}

function FocusShape({ focus }: { focus: [number, number][] | null }) {
  const map = useMap();
  const lastKey = useRef("");
  useEffect(() => {
    if (!focus || focus.length < 3) return;
    const keyValue = focus.map(([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join(";");
    if (lastKey.current === keyValue) return;
    lastKey.current = keyValue;
    const bounds = L.latLngBounds(focus.map(([lng, lat]) => [lat, lng] as [number, number]));
    if (!bounds.isValid()) return;
    const timeout = setTimeout(() => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 19 });
    }, 80);
    return () => clearTimeout(timeout);
  }, [map, focus]);
  return null;
}

function ClickCatcher({ onAdd }: { onAdd: (point: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onAdd([Number(event.latlng.lng.toFixed(6)), Number(event.latlng.lat.toFixed(6))]);
    },
  });
  return null;
}

const vertexIcon = L.divIcon({
  className: "lbank-marker",
  html: '<div style="width:12px;height:12px;border-radius:999px;background:#8c2f43;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

/**
 * Mapa dedicado para demarcar restrições (APP, nascente, linhão, duto…).
 * Clique adiciona vértices; a área é calculada no painel.
 */
export function RestrictionMap({
  polygon,
  setPolygon,
  geometry,
  restrictions = [],
  activeId = null,
  draftArea = 0,
  totalAreaM2 = 0,
  focus = null,
  isAxis = false,
  axis = [],
  axisCorridor = null,
  onAddAxisPoint,
  onMoveVertex,
  onRemoveVertex,
}: {
  polygon: [number, number][];
  setPolygon: (value: [number, number][]) => void;
  geometry?: [number, number][][];
  restrictions?: RestrictionShape[];
  activeId?: number | null;
  draftArea?: number;
  totalAreaM2?: number;
  focus?: [number, number][] | null;
  isAxis?: boolean;
  axis?: [number, number][];
  axisCorridor?: [number, number][] | null;
  onAddAxisPoint?: (point: [number, number]) => void;
  onMoveVertex?: (index: number, point: [number, number], kind: "polygon" | "axis") => void;
  onRemoveVertex?: (index: number, kind: "polygon" | "axis") => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>("satelite");
  const [resizeSignal, setResizeSignal] = useState(0);

  useEffect(() => {
    const onChange = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      setResizeSignal((value) => value + 1);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const element = shellRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      setFullscreen((value) => !value);
    }
    setResizeSignal((value) => value + 1);
  }

  const fitKey = useMemo(() => {
    const points: string[] = [];
    geometry?.forEach((ring) => ring.forEach(([lng, lat]) => points.push(`${lat.toFixed(6)},${lng.toFixed(6)}`)));
    restrictions.forEach((item) =>
      item.coordinates.forEach(([lng, lat]) => points.push(`${lat.toFixed(6)},${lng.toFixed(6)}`)),
    );
    return points.join(";");
  }, [geometry, restrictions]);

  const center = useMemo<[number, number]>(() => {
    const ring = geometry?.[0];
    if (ring && ring.length) {
      const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
      const lng = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
      return [lat, lng];
    }
    return CENTER;
  }, [geometry]);

  return (
    <div
      ref={shellRef}
      className={fullscreen ? "fixed inset-0 z-[1200] flex flex-col bg-white" : "relative h-[260px] w-full"}
    >
      <div className="absolute left-2 top-2 z-[500] flex flex-wrap gap-1 rounded-lg border border-line bg-white/95 p-1 shadow-sm">
        {(["satelite", "mapa", "humanitario"] as BasemapId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setBasemap(id)}
            aria-pressed={basemap === id}
            className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition ${
              basemap === id ? "bg-[#1c5a6b] text-white" : "text-ink hover:bg-paper"
            }`}
          >
            {BASEMAPS[id].label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void toggleFullscreen()
        className="absolute right-2 top-2 z-[500] inline-flex items-center gap-1 rounded-md border border-line bg-white/95 px-2 py-1 text-[10px] font-medium text-ink shadow-sm hover:border-leaf hover:text-leaf-600"
        title={fullscreen ? "Sair da tela cheia" : "Expandir mapa de restrições"}
      >
        {fullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        {fullscreen ? "Sair" : "Expandir"}
      </button>
      <MapContainer
        center={center}
        zoom={16}
        scrollWheelZoom
        className={fullscreen ? "h-full w-full flex-1" : "h-full w-full"}
        preferCanvas
      >
        <MapResizer signal={resizeSignal} />
        <TileLayer
          key={basemap}
          url={BASEMAPS[basemap].url}
          attribution={BASEMAPS[basemap].attribution}
          maxZoom={BASEMAPS[basemap].maxZoom}
        />
        <ClickCatcher
          onAdd={(point) => {
            if (isAxis) onAddAxisPoint?.(point);
            else setPolygon([...polygon, point]);
          }}
        />
        <FitBounds pointsKey={fitKey} signal={resizeSignal} />
        <FocusShape focus={focus} />

        {geometry?.map((ring, index) => (
          <Polygon
            key={`area-${index}`}
            positions={ring.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: "#ffffff", weight: 2.6, opacity: 0.95, fill: false }}
          >
            <Tooltip sticky className="!text-[10px]">
              Perímetro KMZ do imóvel
            </Tooltip>
          </Polygon>
        ))}

        {/* demarcações JÁ SALVAS — permanecem sempre visíveis no mapa */}
        {restrictions.map((item) => {
          const color = TYPE_COLORS[item.type] ?? RESTRICTION_COLOR;
          const active = activeId === item.id;
          const centroid = item.coordinates.reduce(
            (acc, [lng, lat]) => [
              acc[0] + lng / Math.max(1, item.coordinates.length),
              acc[1] + lat / Math.max(1, item.coordinates.length),
            ],
            [0, 0],
          );
          return (
            <Fragment key={`saved-${item.id}`}>
              <Polygon
                positions={item.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])}
                pathOptions={{
                  color,
                  weight: active ? 3.2 : 2,
                  fillColor: color,
                  fillOpacity: active ? 0.55 : 0.4,
                  dashArray: active ? undefined : "6 4",
                }}
              >
                <Tooltip sticky className="!text-[10px]">
                  {TYPE_LABELS[item.type] ?? item.type}
                  {item.label ? ` · ${item.label}` : ""} — {formatArea(item.areaM2)} ({item.lossPct.toFixed(2)}% de perda)
                </Tooltip>
              </Polygon>
              <Marker
                position={[centroid[1], centroid[0]]}
                interactive={false}
                icon={L.divIcon({
                  className: "lbank-marker",
                  html: `<div class="lbank-loss-label"><span style="color:${color};font-weight:700">${(
                    TYPE_LABELS[item.type] ?? "Restrição"
                  ).split(" ")[0]} · ${item.lossPct.toFixed(2)}%</span><br/><span style="color:#33474e">${formatArea(
                    item.areaM2,
                  )}</span></div>`,
                  iconSize: [0, 0],
                })}
              />
            </Fragment>
          );
        })}

        {isAxis && axisCorridor && axisCorridor.length >= 4 ? (
          <Polygon
            positions={axisCorridor.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: RESTRICTION_COLOR_DARK,
              weight: 2.6,
              fillColor: RESTRICTION_COLOR,
              fillOpacity: 0.28,
              dashArray: "8 5",
            }}
          >
            <Tooltip sticky className="!text-[10px]">
              Faixa de servidão gerada pelo eixo
            </Tooltip>
          </Polygon>
        ) : null}

        {isAxis && axis.length >= 2 ? (
          <Polyline
            positions={axis.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: "#f0c623", weight: 3 }}
          >
            <Tooltip sticky className="!text-[10px]">
              Eixo do linhão ({axis.length} pontos)
            </Tooltip>
          </Polyline>
        ) : null}

        {isAxis
          ? axis.map(([lng, lat], index) => (
              <Fragment key={`axis-vertex-${index}-${lng}-${lat}`}>
                <Marker
                  position={[lat, lng]}
                  icon={vertexIcon}
                  draggable
                  eventHandlers={{
                    dragend: (event) => {
                      const position = (event.target as L.Marker).getLatLng();
                      onMoveVertex?.(index, [Number(position.lng.toFixed(6)), Number(position.lat.toFixed(6))], "axis");
                    },
                    click: (event) => {
                      event.originalEvent?.stopPropagation();
                      onRemoveVertex?.(index, "axis");
                    },
                  }}
                >
                  <Tooltip direction="top" className="!text-[9px]">
                    Arraste para corrigir · clique para remover
                  </Tooltip>
                </Marker>
              </Fragment>
            ))
          : null}

        {!isAxis && polygon.length >= 3 ? (
          <Polygon
            positions={polygon.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{
              color: RESTRICTION_COLOR_DARK,
              weight: 2.8,
              fillColor: RESTRICTION_COLOR,
              fillOpacity: 0.3,
              dashArray: "8 5",
            }}
          >
            <Tooltip sticky className="!text-[10px]">
              Demarcação em edição — {formatArea(draftArea)}
              {totalAreaM2 > 0 ? ` (${((draftArea / totalAreaM2) * 100).toFixed(2)}% de perda)` : ""}
            </Tooltip>
          </Polygon>
        ) : polygon.length >= 2 ? (
          <Polyline
            positions={polygon.map(([lng, lat]) => [lat, lng] as [number, number])}
            pathOptions={{ color: RESTRICTION_COLOR, weight: 2.4 }}
          />
        ) : null}

        {polygon.map(([lng, lat], index) => (
          <Fragment key={`vertex-${index}-${lng}-${lat}`}>
            <Marker position={[lat, lng]} icon={vertexIcon} />
          </Fragment>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-lg border border-line bg-white/95 px-2 py-1.5 text-[9px] leading-tight text-ink-soft shadow-sm">
        <p className="font-semibold text-[#8c2f43]">
          Perda mapeada:{" "}
          {totalAreaM2 > 0
            ? `${(
                (restrictions.reduce((sum, item) => sum + item.areaM2, 0) / totalAreaM2) * 100
              ).toFixed(2)}%`
            : "—"}
        </p>
        <p className="text-muted">
          {restrictions.length} demarcação(ões) salva(s)
          {polygon.length >= 3 ? ` + em edição (${formatArea(draftArea)})` : ""}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: RESTRICTION_COLOR }} /> restrição /
          perda demarcada
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f0c623]" /> eixo do linhão
        </p>
      </div>
    </div>
  );
}
