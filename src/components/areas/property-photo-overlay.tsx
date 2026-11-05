import { elevationColor } from "@/lib/contour-colors";

type Bounds = { north: number; south: number; east: number; west: number };

/**
 * FOTO TÉCNICA DO IMÓVEL — imagem de satélite com sobreposição vetorial:
 * perímetro KMZ, curvas de nível (equidistância configurada, padrão 0,5 m),
 * grade de análise alinhada, linhas dos perfis e mapa de calor a 40%.
 * Renderiza no servidor (SVG dentro da ficha em PDF) — não depende de JS.
 */
export function PropertyPhotoOverlay({
  imageSrc,
  bounds,
  geometry,
  contours = [],
  heatmap = null,
  restrictions = [],
  heatmapOpacity = 40,
  showHeatmap = true,
  showContours = true,
  width = 1000,
  height = 460,
  caption,
}: {
  imageSrc: string;
  bounds: Bounds;
  geometry: { coordinates: [number, number][] }[];
  contours?: { elevation: number; coordinates: [number, number][]; kind: string; inside?: boolean }[];
  heatmap?: { rows: number; cols: number; values: number[][]; bounds: Bounds; min: number; max: number } | null;
  restrictions?: { id: number; type: string; label: string; coordinates: [number, number][] }[];
  heatmapOpacity?: number;
  showHeatmap?: boolean;
  showContours?: boolean;
  width?: number;
  height?: number;
  caption?: string;
}) {
  const x = (lng: number) => ((lng - bounds.west) / (bounds.east - bounds.west || 1)) * width;
  const y = (lat: number) => ((bounds.north - lat) / (bounds.north - bounds.south || 1)) * height;

  /**
   * Decimação para impressão: mantém as curvas mestras e as internas ao KMZ,
   * limita a quantidade de polilinhas e simplifica cada traçado (máx. 28 pontos).
   * Preserva a leitura do relevo sem inflar o PDF.
   */
  const MAX_LINES = 200;
  const MAX_POINTS = 28;
  const simplify = (points: [number, number][]) => {
    if (points.length <= MAX_POINTS) return points;
    const step = Math.ceil(points.length / MAX_POINTS);
    const reduced: [number, number][] = [];
    for (let index = 0; index < points.length; index += step) reduced.push(points[index]);
    const last = points[points.length - 1];
    const tail = reduced[reduced.length - 1];
    if (tail[0] !== last[0] || tail[1] !== last[1]) reduced.push(last);
    return reduced;
  };

  const printableContours = contours
    .filter((contour) => contour.inside !== false && contour.coordinates.length >= 2)
    .sort((first, second) => {
      const weight = (kind: string) => (kind === "index" ? 0 : 1);
      return weight(first.kind) - weight(second.kind);
    })
    .slice(0, MAX_LINES);

  const contourElevations = printableContours.map((contour) => contour.elevation);
  const minElevation = contourElevations.length ? Math.min(...contourElevations) : 0;
  const maxElevation = contourElevations.length ? Math.max(...contourElevations) : 1;
  const span = heatmap ? heatmap.max - heatmap.min || 1 : 1;

  const cellWidth = heatmap ? (bounds.east - bounds.west) / Math.max(1, heatmap.cols - 1) : 0;
  const cellHeight = heatmap ? (bounds.north - bounds.south) / Math.max(1, heatmap.rows - 1) : 0;

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt={caption ?? "Imagem técnica do imóvel"} className="absolute inset-0 h-full w-full object-cover" />

        <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {showHeatmap && heatmap
            ? heatmap.values.map((row, rowIndex) =>
                row.map((value, colIndex) => {
                  if (rowIndex >= heatmap.rows - 1 || colIndex >= heatmap.cols - 1) return null;
                  const lng = bounds.west + colIndex * cellWidth;
                  const lat = bounds.north - rowIndex * cellHeight;
                  return (
                    <rect
                      key={`heat-${rowIndex}-${colIndex}`}
                      x={x(lng)}
                      y={y(lat)}
                      width={(cellWidth / (bounds.east - bounds.west || 1)) * width + 1}
                      height={(cellHeight / (bounds.north - bounds.south || 1)) * height + 1}
                      fill={elevationColor(value, heatmap.min, heatmap.min + span)}
                      opacity={heatmapOpacity / 100}
                    />
                  );
                }),
              )
            : null}

          {showContours
            ? printableContours
                .map((contour, index) => (
                  <polyline
                    key={`contour-${index}-${contour.elevation}`}
                    points={simplify(contour.coordinates)
                      .map(([lng, lat]) => `${x(lng).toFixed(1)},${y(lat).toFixed(1)}`)
                      .join(" ")}
                    fill="none"
                    stroke={elevationColor(contour.elevation, minElevation, maxElevation)}
                    strokeWidth={contour.kind === "index" ? 1.7 : 1}
                    opacity="0.95"
                  />
                ))
            : null}

          {restrictions.map((restriction) => (
            <polygon
              key={`restriction-${restriction.id}`}
              points={restriction.coordinates.map(([lng, lat]) => `${x(lng)},${y(lat)}`).join(" ")}
              fill="#84cc16"
              fillOpacity="0.35"
              stroke="#84cc16"
              strokeWidth="1.6"
              strokeDasharray="5 3"
            />
          ))}

          {geometry.map((ring, index) => (
            <polygon
              key={`kmz-${index}`}
              points={ring.coordinates.map(([lng, lat]) => `${x(lng)},${y(lat)}`).join(" ")}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.8"
            />
          ))}

        </svg>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-1 border-t border-line px-2 py-1 text-[7px] text-muted">
        <span>
          {caption ?? "Foto técnica"} · curvas de nível {showContours ? "dentro do KMZ" : "ocultas"} · calor{" "}
          {showHeatmap ? `${heatmapOpacity}%` : "oculto"}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-white ring-1 ring-line" /> KMZ
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-[#84cc16]" /> restrição
          </span>
          <span>Imagens © Esri, Maxar</span>
        </span>
      </figcaption>
    </figure>
  );
}
