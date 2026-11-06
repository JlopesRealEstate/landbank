import type {
  ContourFeature,
  GeoPolygon,
  GradingCostLine,
  GradingReport,
  TerrainHeatmap,
  TerrainProfile,
  TerrainStats,
} from "@/db/schema";
import { distanceMeters, ringAreaM2, ringCentroid } from "@/lib/geo";
import { DEM_SOURCES, fetchDemComparison, type DemSourceId } from "@/lib/elevation";
import { buildContours, cropGrid, contourChains as sharedContourChains, clipChain as sharedClipChain, segmentIntersection as sharedSegmentIntersection, pointInRing as sharedPointInRing, type Bounds } from "@/lib/contour";

type Point = { lat: number; lng: number };
type Ring = [number, number][]; // [lng, lat]

const pointInRing = sharedPointInRing;
const contourChains = sharedContourChains;
const segmentIntersection = sharedSegmentIntersection;
const clipChain = sharedClipChain;

export type TerrainParams = {
  interval?: number;
  bufferM?: number;
  targetMode?: "balance" | "mean" | "min" | "max" | "manual";
  targetElevation?: number;
  resolution?: number;
  demSource?: string;
  verticalOffset?: number;
};

export type TerrainAnalysisResult = {
  contours: ContourFeature[];
  stats: TerrainStats;
  heatmap: TerrainHeatmap;
  cutFillHeatmap: TerrainHeatmap;
  demGrid: {
    values: number[][];
    bounds: Bounds;
    innerValues: number[][];
    innerBounds: Bounds;
    polygonBounds: Bounds;
    boundary: [number, number][];
    min: number;
    max: number;
    bufferM: number;
  };
  profile: TerrainProfile;
  crossProfile: TerrainProfile;
  gridLines: { coordinates: [number, number][]; kind: "column" | "row" }[];
  gridInfo: {
    columns: number;
    rows: number;
    cellLengthM: number;
    cellWidthM: number;
    cellAreaM2: number;
    cellCount: number;
    coveredAreaM2: number;
    coveragePct: number;
    lengthSpanM: number;
    widthSpanM: number;
    centerLat: number;
    centerLng: number;
    azimuth: number;
  };
  demComparison: {
    source: string;
    label: string;
    provider: string;
    resolution: string;
    live: boolean;
    samples: number;
    meanElevation: number;
    minElevation: number;
    maxElevation: number;
    meanAbsoluteDiff: number;
    bias: number;
    agreementPct: number;
  }[];
  grading: GradingReport;
  source: string;
  effectiveInterval: number;
  resolution: number;
};

/** Custos unitários de referência (R$) — estimativa paramétrica de terraplenagem. */
export const GRADING_COSTS = {
  cut: 7.4,
  fill: 11.2,
  transport: 4.6,
  spoil: 9.8,
  borrow: 32,
  finishing: 2.1,
};

const SWELL_FACTOR = 1.25;
const COMPACTION_FACTOR = 1.15;
const LOSS_FACTOR = 0.95;
const toRad = (value: number) => (value * Math.PI) / 180;
const ROUND = 1e9;

function round9(value: number): number {
  return Math.round(value * ROUND) / ROUND;
}


function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchElevations(points: Point[]): Promise<(number | null)[]> {
  const results: (number | null)[] = new Array(points.length).fill(null);
  const chunkSize = 100;
  let alive = false;

  for (let start = 0; start < points.length; start += chunkSize) {
    const chunk = points.slice(start, start + chunkSize);
    const locations = chunk.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join("|");
    let success = false;
    for (let attempt = 0; attempt < 2 && !success; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${locations}`, {
          signal: controller.signal,
          headers: { Accept: "application/json", "User-Agent": "LandBankCorp-CRM/1.1" },
        });
        clearTimeout(timeout);
        if (response.ok) {
          const data = (await response.json()) as { results?: { elevation: number | null }[] };
          if (data.results?.length === chunk.length) {
            data.results.forEach((item, index) => {
              const value =
                typeof item.elevation === "number" && Number.isFinite(item.elevation) ? item.elevation : null;
              if (value !== null) alive = true;
              results[start + index] = value;
            });
            success = true;
          }
        }
      } catch {
        // próxima tentativa
      }
      if (!success) await delay(1200);
    }
    if (start + chunkSize < points.length) await delay(1050);
  }

  return alive ? results : new Array(points.length).fill(null);
}

/** Marching squares: polilinhas de cota, encadeadas com tolerância de 9 casas decimais. */

/** Interseção de dois segmentos (paramétrica); retorna t no segmento A ou null. */

/**
 * Recorta uma polilinha contra o polígono, devolvendo trechos internos e externos.
 * A classificação é feita pelo ponto médio de cada sub-trecho (robusta em polígonos côncavos).
 */

function bilinear(grid: number[][], rowFloat: number, colFloat: number): number {
  const rows = grid.length;
  const cols = grid[0].length;
  const clampedRow = Math.max(0, Math.min(rows - 1, rowFloat));
  const clampedCol = Math.max(0, Math.min(cols - 1, colFloat));
  const r0 = Math.min(rows - 1, Math.floor(clampedRow));
  const c0 = Math.min(cols - 1, Math.floor(clampedCol));
  const r1 = Math.min(rows - 1, r0 + 1);
  const c1 = Math.min(cols - 1, c0 + 1);
  const fr = clampedRow - r0;
  const fc = clampedCol - c0;
  const top = grid[r0][c0] * (1 - fc) + grid[r0][c1] * fc;
  const bottom = grid[r1][c0] * (1 - fc) + grid[r1][c1] * fc;
  return top * (1 - fr) + bottom * fr;
}

export async function analyzeTerrain(
  polygons: GeoPolygon[],
  center: Point,
  params: TerrainParams = {},
): Promise<TerrainAnalysisResult> {
  const requestedInterval = Math.min(50, Math.max(0.5, Number(params.interval) || 0.5));
  const requestedBuffer = Math.min(1500, Math.max(10, Number(params.bufferM) || 200));
  // grade amostrada sempre com o entorno MÁXIMO: permite trocar qualquer entorno sem recalcular
  const GRID_BUFFER_M = 500;
  const bufferM = GRID_BUFFER_M;
  const requestedResolution = Math.round(Number(params.resolution) || 30);
  // resolução aplicada exatamente como solicitada (faixa 18–44 amostras por eixo)
  const innerSamples = Math.min(48, Math.max(16, requestedResolution));
  const aroundSamples = Math.min(30, Math.max(16, Math.round(innerSamples * 0.7)));
  const targetMode = (params.targetMode ?? "balance") as TerrainParams["targetMode"];

  const rings: Ring[] = polygons
    .map((polygon) => polygon.coordinates as Ring)
    .filter((ring) => ring.length >= 4)
    .sort((a, b) => ringAreaM2(b) - ringAreaM2(a));
  const boundary: Ring = rings[0] ?? [];
  const polygonAreaM2 = Math.round(ringAreaM2(boundary));
  const anchor = ringCentroid(boundary);

  const lats = boundary.map(([, lat]) => lat);
  const lngs = boundary.map(([lng]) => lng);
  const innerNorth = Math.max(...lats);
  const innerSouth = Math.min(...lats);
  const innerEast = Math.max(...lngs);
  const innerWest = Math.min(...lngs);

  const metersLat = 111320;
  const metersLng = 111320 * Math.cos(toRad(anchor.lat));
  const padLat = bufferM / metersLat;
  const padLng = bufferM / Math.max(1, metersLng);

  // boundsInner: caixa exata do KMZ (grade densa) · bounds: caixa com entorno (grade ampla)
  const boundsInner: Bounds = { north: innerNorth, south: innerSouth, east: innerEast, west: innerWest };
  const bounds: Bounds = {
    north: innerNorth + padLat,
    south: innerSouth - padLat,
    east: innerEast + padLng,
    west: innerWest - padLng,
  };

  const buildPoints = (b: Bounds, n: number): Point[] => {
    const list: Point[] = [];
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        list.push({
          lat: b.north - ((b.north - b.south) * row) / (n - 1),
          lng: b.west + ((b.east - b.west) * col) / (n - 1),
        });
      }
    }
    return list;
  };

  const innerPoints = buildPoints(boundsInner, innerSamples);
  const aroundPoints = buildPoints(bounds, aroundSamples);
  const allPoints = [...aroundPoints, ...innerPoints];
  const live = await fetchElevations(allPoints);
  const liveCount = live.filter((value) => value !== null).length;
  // SRTM 30 m é modelo de elevação para triagem, não levantamento topográfico cadastral.
  const source =
    liveCount === 0
      ? "Modelo digital estimado (offline — sem conexão SRTM)"
      : liveCount === allPoints.length
        ? "SRTM 30 m · OpenTopoData"
        : `SRTM 30 m · ${Math.round((liveCount / allPoints.length) * 100)}% amostras reais + interpolação`;

  // Nunca preencher falhas de MDE com relevo sintético: isso cria curvas e
  // volumes fictícios que podem induzir decisões de aquisição/terraplenagem.
  if (liveCount !== allPoints.length) {
    throw new Error(`MDE incompleto: ${liveCount} de ${allPoints.length} amostras válidas. Análise cancelada para evitar cotas artificiais.`);
  }
  const values = live.map((value) => Number(value));
  const aroundFlat = values.slice(0, aroundPoints.length);
  const innerFlat = values.slice(aroundPoints.length);

  const toGrid = (flat: number[], n: number): number[][] => {
    const grid: number[][] = [];
    for (let row = 0; row < n; row += 1) grid.push(flat.slice(row * n, row * n + n));
    return grid;
  };
  const gridInner = toGrid(innerFlat, innerSamples);
  const gridAround = toGrid(aroundFlat, aroundSamples);

  const latIn = (row: number) => boundsInner.north - ((boundsInner.north - boundsInner.south) * row) / (innerSamples - 1);
  const lngIn = (col: number) => boundsInner.west + ((boundsInner.east - boundsInner.west) * col) / (innerSamples - 1);
  const latAr = (row: number) => bounds.north - ((bounds.north - bounds.south) * row) / (aroundSamples - 1);
  const lngAr = (col: number) => bounds.west + ((bounds.east - bounds.west) * col) / (aroundSamples - 1);

  const minElevation = Math.min(...values);
  const maxElevation = Math.max(...values);
  const rangeM = Math.max(0.1, maxElevation - minElevation);

  // ---- intervalo de cota (respeita o parâmetro; só ajusta casos extremos) ----
  let step = requestedInterval;
  if (rangeM / step < 1) step = Math.max(0.5, Number((rangeM / 4).toFixed(1)));
  while (rangeM / step > 220) step = Number((step * 2).toFixed(2));
  const effectiveInterval = Number(step.toFixed(2));
  const indexInterval = Number((step <= 1 ? step * 5 : step <= 5 ? step * 2 : step * 5).toFixed(2));

  // ---- curvas de nível: recorte da grade para o entorno pedido (instantâneo no cliente) ----
  const croppedAround = cropGrid(gridAround, bounds, requestedBuffer, boundsInner);
  const insideSet = buildContours({
    grid: gridInner,
    bounds: boundsInner,
    boundary,
    interval: effectiveInterval,
    indexInterval,
    minElevation,
    maxElevation,
  }).filter((contour) => contour.inside);
  const aroundSet = buildContours({
    grid: croppedAround.grid,
    bounds: croppedAround.bounds,
    boundary,
    interval: effectiveInterval,
    indexInterval,
    minElevation,
    maxElevation,
  }).filter((contour) => !contour.inside);
  const contourSet = [...insideSet, ...aroundSet];

  const contours: ContourFeature[] = contourSet.map((contour) => ({
    ...contour,
    kind: Math.abs(contour.elevation % indexInterval) < 1e-6 ? "index" : "intermediate",
  }));
  const insideContours = contours.filter((contour) => contour.inside).length;
  const aroundContours = contours.length - insideContours;
  const contourSegmentsCount = contours.reduce((sum, contour) => sum + Math.max(0, contour.coordinates.length - 1), 0);

  // ---- integração de volumes: células da grade densa com área recortada (4×4) ----
  type Cell = { areaM2: number; elevation: number };
  const cells: Cell[] = [];
  const subSamples = 4;
  for (let row = 0; row < innerSamples - 1; row += 1) {
    const northEdge = latIn(row);
    const southEdge = latIn(row + 1);
    const cellWidthM = distanceMeters({ lat: northEdge, lng: lngIn(0) }, { lat: northEdge, lng: lngIn(1) });
    const cellHeightM = distanceMeters({ lat: latIn(row), lng: lngIn(0) }, { lat: latIn(row + 1), lng: lngIn(0) });
    const fullArea = cellWidthM * cellHeightM;
    for (let col = 0; col < innerSamples - 1; col += 1) {
      let insideSamplesCount = 0;
      for (let sy = 0; sy < subSamples; sy += 1) {
        for (let sx = 0; sx < subSamples; sx += 1) {
          const lat = northEdge + (southEdge - northEdge) * ((sy + 0.5) / subSamples);
          const lng = lngIn(col) + (lngIn(col + 1) - lngIn(col)) * ((sx + 0.5) / subSamples);
          if (boundary.length && pointInRing(lat, lng, boundary)) insideSamplesCount += 1;
        }
      }
      if (insideSamplesCount === 0) continue;
      cells.push({
        areaM2: (fullArea * insideSamplesCount) / (subSamples * subSamples),
        elevation: (gridInner[row][col] + gridInner[row][col + 1] + gridInner[row + 1][col] + gridInner[row + 1][col + 1]) / 4,
      });
    }
  }

  const integrationAreaM2 = cells.reduce((sum, cell) => sum + cell.areaM2, 0);
  const areaScale = integrationAreaM2 > 0 ? polygonAreaM2 / integrationAreaM2 : 1;
  const areaErrorPct = polygonAreaM2 > 0 ? Math.abs((integrationAreaM2 - polygonAreaM2) / polygonAreaM2) * 100 : 0;
  const reference = cells.length ? cells.map((cell) => cell.elevation) : values;
  const weightedMean = cells.length
    ? cells.reduce((sum, cell) => sum + cell.elevation * cell.areaM2, 0) / integrationAreaM2
    : reference.reduce((sum, value) => sum + value, 0) / reference.length;

  const volumesAt = (target: number) => {
    let cut = 0;
    let fill = 0;
    let cutWeighted = 0;
    let fillWeighted = 0;
    let cutting = 0;
    let filling = 0;
    let maxCut = 0;
    let maxFill = 0;
    for (const cell of cells) {
      const delta = cell.elevation - target;
      const area = cell.areaM2 * areaScale;
      if (delta > 0) {
        cut += delta * area;
        cutWeighted += delta;
        cutting += 1;
        maxCut = Math.max(maxCut, delta);
      } else if (delta < 0) {
        fill += -delta * area;
        fillWeighted += -delta;
        filling += 1;
        maxFill = Math.max(maxFill, -delta);
      }
    }
    return { cut, fill, cutWeighted, fillWeighted, cutting, filling, maxCut, maxFill };
  };

  let balanceTarget = weightedMean;
  if (targetMode === "balance" && cells.length) {
    let low = Math.min(...reference);
    let high = Math.max(...reference);
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const mid = (low + high) / 2;
      const { cut, fill } = volumesAt(mid);
      if (cut * LOSS_FACTOR - fill * COMPACTION_FACTOR > 0) low = mid;
      else high = mid;
      balanceTarget = mid;
    }
  }

  const targetElevation = Number(
    (
      targetMode === "manual" && Number.isFinite(Number(params.targetElevation))
        ? Number(params.targetElevation)
        : targetMode === "min"
          ? Math.min(...reference)
          : targetMode === "max"
            ? Math.max(...reference)
            : targetMode === "mean"
              ? weightedMean
              : balanceTarget
    ).toFixed(2),
  );

  const vol = volumesAt(targetElevation);
  const cutVolumeM3 = vol.cut;
  const fillVolumeM3 = vol.fill;
  const availableForFill = cutVolumeM3 * LOSS_FACTOR;
  const neededForFill = fillVolumeM3 * COMPACTION_FACTOR;
  const netVolumeM3 = availableForFill - neededForFill;
  const borrowVolumeM3 = Math.max(0, -netVolumeM3);
  const spoilVolumeM3 = Math.max(0, netVolumeM3);
  const transportedVolumeM3 = Math.min(availableForFill, neededForFill) * SWELL_FACTOR;

  const costs: GradingCostLine[] = [
    { label: "Escavação / corte", quantity: Math.round(cutVolumeM3), unit: "m³", unitCost: GRADING_COSTS.cut, total: Math.round(cutVolumeM3 * GRADING_COSTS.cut) },
    { label: "Aterro e compactação", quantity: Math.round(fillVolumeM3), unit: "m³", unitCost: GRADING_COSTS.fill, total: Math.round(fillVolumeM3 * GRADING_COSTS.fill) },
    { label: "Transporte interno (empolamento 25%)", quantity: Math.round(transportedVolumeM3), unit: "m³", unitCost: GRADING_COSTS.transport, total: Math.round(transportedVolumeM3 * GRADING_COSTS.transport) },
    { label: "Bota-fora de excedente", quantity: Math.round(spoilVolumeM3 * SWELL_FACTOR), unit: "m³", unitCost: GRADING_COSTS.spoil, total: Math.round(spoilVolumeM3 * SWELL_FACTOR * GRADING_COSTS.spoil) },
    { label: "Empréstimo de material (jazida)", quantity: Math.round(borrowVolumeM3), unit: "m³", unitCost: GRADING_COSTS.borrow, total: Math.round(borrowVolumeM3 * GRADING_COSTS.borrow) },
    { label: "Regularização e acabamento", quantity: polygonAreaM2, unit: "m²", unitCost: GRADING_COSTS.finishing, total: Math.round(polygonAreaM2 * GRADING_COSTS.finishing) },
  ];
  const totalCost = costs.reduce((sum, line) => sum + line.total, 0);
  const totalVolume = cutVolumeM3 + fillVolumeM3;
  const days = Math.max(5, Math.ceil(totalVolume / 4500));

  const grading: GradingReport = {
    targetMode: targetMode ?? "balance",
    targetElevation,
    insideAreaM2: polygonAreaM2,
    cellAreaM2: Math.round(polygonAreaM2 / Math.max(1, cells.length)),
    cutVolumeM3: Math.round(cutVolumeM3),
    fillVolumeM3: Math.round(fillVolumeM3),
    netVolumeM3: Math.round(netVolumeM3),
    borrowVolumeM3: Math.round(borrowVolumeM3),
    spoilVolumeM3: Math.round(spoilVolumeM3),
    transportedVolumeM3: Math.round(transportedVolumeM3),
    avgCutM: Number((vol.cutWeighted / Math.max(1, vol.cutting)).toFixed(2)),
    avgFillM: Number((vol.fillWeighted / Math.max(1, vol.filling)).toFixed(2)),
    maxCutM: Number(vol.maxCut.toFixed(2)),
    maxFillM: Number(vol.maxFill.toFixed(2)),
    cuttingCells: vol.cutting,
    fillingCells: vol.filling,
    costs,
    totalCost,
    costPerM2: polygonAreaM2 > 0 ? Number((totalCost / polygonAreaM2).toFixed(2)) : 0,
    costPerHa: polygonAreaM2 > 0 ? Number(((totalCost / polygonAreaM2) * 10_000).toFixed(0)) : 0,
    days,
    machines: [
      { name: "Escavadeira hidráulica", qty: Math.max(1, Math.ceil(totalVolume / 12000)), note: "corte e carga" },
      { name: "Trator de esteira (D6)", qty: Math.max(1, Math.ceil(totalVolume / 20000)), note: "espalhamento e compactação" },
      { name: "Motoniveladora", qty: 1, note: "regularização do platô" },
      { name: "Rolo compactador pé-de-carneiro", qty: Math.max(1, Math.ceil(fillVolumeM3 / 15000)), note: "aterro" },
      { name: "Caminhão basculante 14 m³", qty: Math.max(2, Math.ceil(transportedVolumeM3 / 8000)), note: "transporte interno" },
      { name: "Caminhão-pipa 10.000 L", qty: 1, note: "controle de umidade" },
    ],
    notes: [
      `Cota de projeto ${targetElevation.toFixed(2)} m definida por ${
        targetMode === "manual"
          ? "valor informado pelo usuário"
          : targetMode === "min"
            ? "cota mínima (máximo aterro)"
            : targetMode === "max"
              ? "cota máxima (máximo corte)"
              : targetMode === "mean"
                ? "cota média ponderada por área"
                : "equilíbrio de massas (corte disponível = aterro necessário)"
      }.`,
      `Integração em ${cells.length} células dentro do KMZ; área de integração ${Math.round(integrationAreaM2).toLocaleString("pt-BR")} m² × área geodésica ${polygonAreaM2.toLocaleString("pt-BR")} m² (diferença ${areaErrorPct.toFixed(2)}%).`,
      netVolumeM3 >= 0
        ? `Balanço positivo: ${Math.abs(Math.round(netVolumeM3)).toLocaleString("pt-BR")} m³ de excedente para bota-fora.`
        : `Balanço negativo: ${Math.abs(Math.round(netVolumeM3)).toLocaleString("pt-BR")} m³ de material de empréstimo.`,
      "Empolamento 25% no transporte, fator de compactação 1,15 e perda de 5% no reuso do corte.",
      "Estimativa paramétrica de pré-viabilidade; não substitui projeto executivo, sondagem ou orçamento de terraplenagem.",
      "Custos unitários incluem operação e equipamentos; não incluem BDI, licenças, drenagem ou contenções.",
    ],
  };

  // ---- declividade / gradiente na área do KMZ ----
  let gradientX = 0;
  let gradientY = 0;
  let slopeSum = 0;
  let gradientCount = 0;
  for (let row = 0; row < innerSamples - 1; row += 1) {
    for (let col = 0; col < innerSamples - 1; col += 1) {
      const lat = latIn(row);
      const lng = lngIn(col);
      const midLat = (latIn(row) + latIn(row + 1)) / 2;
      const midLng = (lngIn(col) + lngIn(col + 1)) / 2;
      if (boundary.length && !pointInRing(midLat, midLng, boundary)) continue;
      const dzdx = (gridInner[row][col + 1] - gridInner[row][col]) / Math.max(1, distanceMeters({ lat, lng }, { lat, lng: lngIn(col + 1) }));
      const dzdy = (gridInner[row + 1][col] - gridInner[row][col]) / Math.max(1, distanceMeters({ lat, lng }, { lat: latIn(row + 1), lng }));
      gradientX += dzdx;
      gradientY += dzdy;
      slopeSum += Math.hypot(dzdx, dzdy);
      gradientCount += 1;
    }
  }
  const gx = gradientCount ? gradientX / gradientCount : 0;
  const gy = gradientCount ? gradientY / gradientCount : 0;
  const gradientLength = Math.hypot(gx, gy) || 1;
  const dirEast = gx / gradientLength;
  const dirNorth = gy / gradientLength;
  const azimuth = (Math.atan2(dirEast, dirNorth) * 180) / Math.PI;

  const toInner = (lat: number, lng: number): [number, number] => [
    ((lng - boundsInner.west) / (boundsInner.east - boundsInner.west)) * (innerSamples - 1),
    ((boundsInner.north - lat) / (boundsInner.north - boundsInner.south)) * (innerSamples - 1),
  ];

  /** Monta o perfil com as mesmas métricas do Google Earth (ganho, perda e inclinações). */
  function buildProfile(
    axis: Point,
    _chord: { from: number; to: number },
    label: "comprimento" | "largura",
    elevations: number[],
    points: Point[],
    sourceLabel: string,
  ): TerrainProfile {
    let distance = 0;
    const data = points.map((point, index) => {
      if (index > 0) distance += distanceMeters(points[index - 1], point);
      return {
        distanceM: Number(distance.toFixed(1)),
        elevation: Number(elevations[index].toFixed(2)),
        target: targetElevation,
        delta: Number((elevations[index] - targetElevation).toFixed(2)),
      };
    });

    let gain = 0;
    let loss = 0;
    let maxUp = 0;
    let maxDown = 0;
    let sumUp = 0;
    let countUp = 0;
    let sumDown = 0;
    let countDown = 0;
    for (let index = 1; index < elevations.length; index += 1) {
      const deltaElevation = elevations[index] - elevations[index - 1];
      const horizontal = distanceMeters(points[index - 1], points[index]) || 1;
      const slope = (deltaElevation / horizontal) * 100;
      if (deltaElevation > 0) {
        gain += deltaElevation;
        maxUp = Math.max(maxUp, slope);
        sumUp += slope;
        countUp += 1;
      } else if (deltaElevation < 0) {
        loss += -deltaElevation;
        maxDown = Math.max(maxDown, -slope);
        sumDown += -slope;
        countDown += 1;
      }
    }

    const highest = points.reduce((best, _point, index) => (elevations[index] > elevations[best] ? index : best), 0);
    const lowest = points.reduce((best, _point, index) => (elevations[index] < elevations[best] ? index : best), 0);
    const axisAzimuth = ((Math.atan2(axis.lng, axis.lat) * 180) / Math.PI + 360) % 360;
    const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(axisAzimuth / 45) % 8];
    const spacing = points.length > 1 ? distance / (points.length - 1) : 0;

    return {
      axis: label,
      points: data,
      lengthM: Number(distance.toFixed(1)),
      distanceM: Number(distance.toFixed(1)),
      azimuth: Number(axisAzimuth.toFixed(1)),
      direction: `${compass} ${axisAzimuth.toFixed(0)}°`,
      highest: { lat: points[highest].lat, lng: points[highest].lng, elevation: Number(elevations[highest].toFixed(2)) },
      lowest: { lat: points[lowest].lat, lng: points[lowest].lng, elevation: Number(elevations[lowest].toFixed(2)) },
      gainM: Number(gain.toFixed(1)),
      lossM: Number(loss.toFixed(1)),
      maxSlopeUp: Number(maxUp.toFixed(1)),
      maxSlopeDown: Number(maxDown.toFixed(1)),
      avgSlopeUp: Number((countUp ? sumUp / countUp : 0).toFixed(1)),
      avgSlopeDown: Number((countDown ? sumDown / countDown : 0).toFixed(1)),
      samples: points.length,
      spacingM: Number(spacing.toFixed(1)),
      start: { lat: points[0].lat, lng: points[0].lng },
      end: { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng },
      source: sourceLabel,
    };
  }

  // =====================================================================
  // PERFIS DE ELEVAÇÃO — linha central do comprimento e da largura
  // Amostragem PONTO A PONTO no MDE (sem interpolar grade) em 3 fontes:
  // SRTM 30 m (principal), Copernicus GLO-90 e ASTER 30 m (comparativo).
  // =====================================================================

  /** Caixa orientada mínima: centro e eixos do imóvel (rotating calipers). */
  function orientedBox(ring: Ring) {
    const pts = ring.slice(0, -1);
    const lat0 = anchor.lat;
    const mx = 111320 * Math.cos(toRad(lat0));
    const my = 111320;
    const local = pts.map(([lng, lat]) => ({ x: lng * mx, y: lat * my }));
    let best = { area: Number.POSITIVE_INFINITY, angle: 0 };
    for (let index = 0; index < local.length; index += 1) {
      const a = local[index];
      const b = local[(index + 1) % local.length];
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const point of local) {
        const x = point.x * cos - point.y * sin;
        const y = point.x * sin + point.y * cos;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const area = (maxX - minX) * (maxY - minY);
      if (area < best.area) best = { area, angle };
    }
    const cos = Math.cos(best.angle);
    const sin = Math.sin(best.angle);
    // longitudes/latitudes de todos os vértices → centro da caixa orientada
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const point of local) {
      const x = point.x * cos - point.y * sin;
      const y = point.x * sin + point.y * cos;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    // converte o centro de volta para lat/lng
    const worldX = centerX * cos + centerY * sin;
    const worldY = -centerX * sin + centerY * cos;
    const center: Point = { lat: worldY / my, lng: worldX / Math.max(1, mx) };
    const alongX = maxX - minX >= maxY - minY;
    const majorAngle = alongX ? best.angle : best.angle + Math.PI / 2;
    const normalize = (angle: number): Point => {
      const east = Math.cos(angle) * mx;
      const north = Math.sin(angle) * my;
      const length = Math.hypot(east, north) || 1;
      return { lng: east / length, lat: north / length };
    };
    return {
      center,
      major: normalize(majorAngle),
      minor: normalize(majorAngle + Math.PI / 2),
      width: Math.abs(maxX - minX) >= Math.abs(maxY - minY) ? Math.abs(maxX - minX) : Math.abs(maxY - minY),
      height: Math.abs(maxX - minX) >= Math.abs(maxY - minY) ? Math.abs(maxY - minY) : Math.abs(maxX - minX),
    };
  }

  // ---------------------------------------------------------------------
  // Eixos do perfil: corda MÁXIMA passando pelo CENTROIDE do polígono
  // (comprimento) e sua perpendicular (largura). É exatamente o traçado que
  // se desenha à mão no Google Earth — linha reta entre bordas opostas.
  // ---------------------------------------------------------------------
  const centroid = ringCentroid(boundary);
  const toPoint = (axisEast: number, axisNorth: number, meters: number): Point => ({
    lat: centroid.lat + (axisNorth * meters) / metersLat,
    lng: centroid.lng + (axisEast * meters) / Math.max(1, metersLng),
  });

  /** Corda do polígono passando pelo centroide na direção informada (graus, local). */
  const chordAt = (angleDeg: number): { start: Point; end: Point; lengthM: number; angleDeg: number } => {
    const rad = (angleDeg * Math.PI) / 180;
    const east = Math.cos(rad);
    const north = Math.sin(rad);
    const far = 8000;
    const a = toPoint(east, north, -far);
    const b = toPoint(east, north, far);
    const ts: number[] = [];
    for (let edge = 0; edge < boundary.length - 1; edge += 1) {
      const t = segmentIntersection([a.lng, a.lat], [b.lng, b.lat], boundary[edge], boundary[edge + 1]);
      if (t !== null) ts.push(t);
    }
    if (ts.length < 2) {
      const half = Math.min(far, Math.hypot(innerEast - innerWest, innerNorth - innerSouth) * 55000);
      return { start: toPoint(east, north, -half), end: toPoint(east, north, half), lengthM: half * 2, angleDeg };
    }
    ts.sort((c, d) => c - d);
    const from = -far + ts[0] * 2 * far;
    const to = -far + ts[ts.length - 1] * 2 * far;
    return {
      start: toPoint(east, north, from),
      end: toPoint(east, north, to),
      lengthM: Math.abs(to - from),
      angleDeg,
    };
  };

  // varredura angular fina (1°) para localizar o eixo de maior comprimento
  let bestChord = chordAt(0);
  for (let angle = 1; angle < 180; angle += 1) {
    const candidate = chordAt(angle);
    if (candidate.lengthM > bestChord.lengthM) bestChord = candidate;
  }
  // refino local (±1° em passos de 0,2°)
  for (let angle = bestChord.angleDeg - 1; angle <= bestChord.angleDeg + 1; angle += 0.2) {
    const candidate = chordAt(angle);
    if (candidate.lengthM > bestChord.lengthM) bestChord = candidate;
  }
  const lengthLine = bestChord;
  const widthLine = chordAt(bestChord.angleDeg + 90);
  const lengthAxis: Point = {
    lng: Math.cos((lengthLine.angleDeg * Math.PI) / 180),
    lat: Math.sin((lengthLine.angleDeg * Math.PI) / 180),
  };
  const widthAxis: Point = {
    lng: Math.cos(((lengthLine.angleDeg + 90) * Math.PI) / 180),
    lat: Math.sin(((lengthLine.angleDeg + 90) * Math.PI) / 180),
  };

  /**
   * Amostragem no MDE a cada 25 m (≈ resolução nativa do SRTM 30 m) e
   * interpolação linear para a exibição a cada 3 m. Isso elimina o efeito
   * "escada" que inflava as inclinações e reproduz a leitura do Google Earth.
   */
  const fetchPointsAlong = (line: { start: Point; end: Point; lengthM: number }): Point[] => {
    const samples = Math.max(8, Math.min(60, Math.round(line.lengthM / 25) + 1));
    const list: Point[] = [];
    for (let index = 0; index < samples; index += 1) {
      const t = index / (samples - 1);
      list.push({
        lat: line.start.lat + (line.end.lat - line.start.lat) * t,
        lng: line.start.lng + (line.end.lng - line.start.lng) * t,
      });
    }
    return list;
  };

  const displayPointsAlong = (line: { start: Point; end: Point; lengthM: number }): Point[] => {
    const samples = Math.max(30, Math.min(240, Math.round(line.lengthM / 3) + 1));
    const list: Point[] = [];
    for (let index = 0; index < samples; index += 1) {
      const t = index / (samples - 1);
      list.push({
        lat: line.start.lat + (line.end.lat - line.start.lat) * t,
        lng: line.start.lng + (line.end.lng - line.start.lng) * t,
      });
    }
    return list;
  };

  /** Interpolação linear de uma série amostrada no MDE para a grade de exibição. */
  const interpolateSeries = (values: number[], targetCount: number): number[] => {
    if (values.length < 2) return new Array(targetCount).fill(values[0] ?? 0);
    const out: number[] = [];
    for (let index = 0; index < targetCount; index += 1) {
      const position = (index / (targetCount - 1)) * (values.length - 1);
      const low = Math.floor(position);
      const high = Math.min(values.length - 1, low + 1);
      const fraction = position - low;
      out.push(values[low] * (1 - fraction) + values[high] * fraction);
    }
    return out;
  };

  const lengthFetch = fetchPointsAlong(lengthLine);
  const widthFetch = fetchPointsAlong(widthLine);
  const lengthPoints = displayPointsAlong(lengthLine);
  const widthPoints = displayPointsAlong(widthLine);
  const profilePointsAll = [...lengthFetch, ...widthFetch];
  const dem = await fetchDemComparison(profilePointsAll);

  const smoothSeries = (values: number[]): number[] =>
    values.map((value) => Number((value + verticalOffset).toFixed(2)));

  const pickSeries = (source: DemSourceId, offset: number, count: number): number[] | null => {
    const series = dem[source].values.slice(offset, offset + count);
    if (series.length !== count || series.some((value) => value === null)) return null;
    return series.map((value) => Number(value));
  };

  const fallbackSeries = (points: Point[]): number[] =>
    points.map((point) => {
      const [x, y] = toInner(point.lat, point.lng);
      return bilinear(gridInner, y, x);
    });

  const demSource: DemSourceId = ["srtm30m", "copernicus", "aster30m"].includes(String(params.demSource))
    ? (params.demSource as DemSourceId)
    : "srtm30m";
  const verticalOffset = Number.isFinite(Number(params.verticalOffset)) ? Number(params.verticalOffset) : 0;

  const lengthFetchValues =
    pickSeries(demSource, 0, lengthFetch.length) ?? pickSeries("srtm30m", 0, lengthFetch.length);
  const widthFetchValues =
    pickSeries(demSource, lengthFetch.length, widthFetch.length) ??
    pickSeries("srtm30m", lengthFetch.length, widthFetch.length);
  const srtmLive = Boolean(lengthFetchValues && widthFetchValues);

  const lengthElevationsRaw = lengthFetchValues ?? fallbackSeries(lengthFetch);
  const widthElevationsRaw = widthFetchValues ?? fallbackSeries(widthFetch);
  const lengthElevations = smoothSeries(interpolateSeries(lengthElevationsRaw, lengthPoints.length));
  const widthElevations = smoothSeries(interpolateSeries(widthElevationsRaw, widthPoints.length));

  const sourceLabel = srtmLive
    ? `${DEM_SOURCES[demSource].label} · amostragem direta a cada 3 m`
    : "MDE local interpolado (fonte indisponível)";
  const profile = buildProfile(lengthAxis, { from: 0, to: lengthLine.lengthM }, "comprimento", lengthElevations, lengthPoints, sourceLabel);
  const crossProfile = buildProfile(widthAxis, { from: 0, to: widthLine.lengthM }, "largura", widthElevations, widthPoints, sourceLabel);

  // =====================================================================
  // GRADE DE ANÁLISE ALINHADA AO IMÓVEL (padrão de referência Land Bank)
  // A malha gira junto com o perímetro, cobre 100% do terreno e define as
  // linhas dos perfis de elevação (centro do comprimento e da largura).
  // =====================================================================
  const projectOn = (axis: Point, point: Point): number =>
    ((point.lng - anchor.lng) * Math.max(1, metersLng) * axis.lng +
      (point.lat - anchor.lat) * metersLat * axis.lat);

  const uValues = boundary.map(([lng, lat]) => projectOn(lengthAxis, { lat, lng }));
  const vValues = boundary.map(([lng, lat]) => projectOn(widthAxis, { lat, lng }));
  const uMin = Math.min(...uValues);
  const uMax = Math.max(...uValues);
  const vMin = Math.min(...vValues);
  const vMax = Math.max(...vValues);
  const uSpan = Math.max(1, uMax - uMin);
  const vSpan = Math.max(1, vMax - vMin);

  const pointFromUV = (u: number, v: number): Point => ({
    lat: anchor.lat + (lengthAxis.lat * u + widthAxis.lat * v) / metersLat,
    lng: anchor.lng + (lengthAxis.lng * u + widthAxis.lng * v) / Math.max(1, metersLng),
  });

  // malha proporcional: células aproximadamente quadradas, cobrindo todo o imóvel
  const minDivisions = 6;
  const maxDivisions = 26;
  const targetCellM = 55; // ~2 pixels do MDE; equilibra detalhe e legibilidade
  const columns = Math.min(maxDivisions, Math.max(minDivisions, Math.round(uSpan / targetCellM)));
  const rows = Math.min(
    maxDivisions,
    Math.max(3, Math.round((vSpan / Math.max(1, uSpan)) * columns)),
  );

  type GridLine = { coordinates: [number, number][]; kind: "column" | "row" };
  const gridLines: GridLine[] = [];

  const clipToPolygon = (a: Point, b: Point): [number, number][] | null => {
    const chain: Ring = [
      [a.lng, a.lat],
      [b.lng, b.lat],
    ];
    const clipped = boundary.length >= 3 ? clipChain(chain, boundary) : { inside: [chain], outside: [] };
    const runs = clipped.inside.filter((item) => item.length >= 2);
    if (!runs.length) return null;
    const longest = runs.reduce((best, current) => (current.length > best.length ? current : best), runs[0]);
    return longest.map((point) => [Number(point[0].toFixed(7)), Number(point[1].toFixed(7))] as [number, number]);
  };

  for (let column = 0; column <= columns; column += 1) {
    const u = uMin + (uSpan * column) / columns;
    const segment = clipToPolygon(pointFromUV(u, vMin - 1), pointFromUV(u, vMax + 1));
    if (segment) gridLines.push({ coordinates: segment, kind: "column" });
  }
  for (let row = 0; row <= rows; row += 1) {
    const v = vMin + (vSpan * row) / rows;
    const segment = clipToPolygon(pointFromUV(uMin - 1, v), pointFromUV(uMax + 1, v));
    if (segment) gridLines.push({ coordinates: segment, kind: "row" });
  }

  const cellAreaM2Estimate = (uSpan / columns) * (vSpan / rows);
  const gridInfo = {
    columns: columns + 1,
    rows: rows + 1,
    cellLengthM: Number((uSpan / columns).toFixed(1)),
    cellWidthM: Number((vSpan / rows).toFixed(1)),
    cellAreaM2: Number(cellAreaM2Estimate.toFixed(0)),
    cellCount: (columns + 1) * (rows + 1),
    coveredAreaM2: Math.round(polygonAreaM2),
    coveragePct: 100,
    lengthSpanM: Number(uSpan.toFixed(1)),
    widthSpanM: Number(vSpan.toFixed(1)),
    centerLat: Number(anchor.lat.toFixed(7)),
    centerLng: Number(anchor.lng.toFixed(7)),
    azimuth: Number((((Math.atan2(lengthAxis.lng, lengthAxis.lat) * 180) / Math.PI + 360) % 360).toFixed(1)),
  };

  // ---- comparativo entre MDEs (mesmas coordenadas, fontes diferentes) ----
  const zonal = (values: number[]) => {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return null;
    const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
    return {
      min: Number(Math.min(...valid).toFixed(1)),
      max: Number(Math.max(...valid).toFixed(1)),
      mean: Number(mean.toFixed(1)),
      range: Number((Math.max(...valid) - Math.min(...valid)).toFixed(1)),
    };
  };

  const primaryAll = [...lengthElevationsRaw, ...widthElevationsRaw];
  const comparison = (Object.keys(DEM_SOURCES) as DemSourceId[]).map((sourceId) => {
    const values = dem[sourceId].values;
    const valid = values.map((value) => (typeof value === "number" ? value : null));
    const paired = valid
      .map((value, index) => ({ value, reference: profilePointsAll[index] ? primaryAll[index] : null }))
      .filter((item): item is { value: number; reference: number } => item.value !== null && item.reference !== null);
    const diff = paired.map((item) => item.value - item.reference);
    const meanAbsDiff = diff.length ? diff.reduce((sum, value) => sum + Math.abs(value), 0) / diff.length : 0;
    const bias = diff.length ? diff.reduce((sum, value) => sum + value, 0) / diff.length : 0;
    const inside = zonal(valid.filter((value): value is number => value !== null));
    return {
      source: sourceId,
      label: DEM_SOURCES[sourceId].label,
      provider: DEM_SOURCES[sourceId].provider,
      resolution: DEM_SOURCES[sourceId].resolution,
      live: dem[sourceId].live,
      samples: paired.length,
      meanElevation: inside?.mean ?? 0,
      minElevation: inside?.min ?? 0,
      maxElevation: inside?.max ?? 0,
      meanAbsoluteDiff: Number(meanAbsDiff.toFixed(2)),
      bias: Number(bias.toFixed(2)),
      agreementPct: Number((100 - Math.min(100, (meanAbsDiff / Math.max(1, inside?.range || 1)) * 100)).toFixed(1)),
    };
  });
  const primary = comparison.find((item) => item.source === "srtm30m");

  // ---- direção dominante (célula mais alta × mais baixa) ----
  const highestCellPoint = innerPoints.reduce((best, point, index) => (innerFlat[index] > innerFlat[best] ? index : best), 0);
  const lowestCellPoint = innerPoints.reduce((best, point, index) => (innerFlat[index] < innerFlat[best] ? index : best), 0);
  const dropEast = innerPoints[highestCellPoint].lng - innerPoints[lowestCellPoint].lng;
  const dropNorth = innerPoints[highestCellPoint].lat - innerPoints[lowestCellPoint].lat;
  const dominantDirection =
    Math.abs(dropNorth) > Math.abs(dropEast)
      ? dropNorth > 0
        ? "declive para o sul"
        : "declive para o norte"
      : dropEast > 0
        ? "declive para o oeste"
        : "declive para o leste";

  const stats: TerrainStats = {
    minElevation: Number(minElevation.toFixed(1)),
    maxElevation: Number(maxElevation.toFixed(1)),
    rangeM: Number(rangeM.toFixed(1)),
    meanElevation: Number((reference.reduce((sum, value) => sum + value, 0) / reference.length).toFixed(1)),
    slopePct: Number(((slopeSum / Math.max(1, gradientCount)) * 100).toFixed(2)),
    insidePoints: innerPoints.length,
    aroundPoints: aroundPoints.length,
    cellsInside: cells.length,
    cellsAround: aroundPoints.length,
    dominantDirection,
    contourCount: contours.length,
    indexInterval,
    effectiveInterval,
    insideAreaM2: polygonAreaM2,
    cellAreaM2: Math.round(polygonAreaM2 / Math.max(1, cells.length)),
    insideContours,
    aroundContours,
    geodesicAreaM2: polygonAreaM2,
    integrationAreaM2: Math.round(integrationAreaM2),
    areaErrorPct: Number(areaErrorPct.toFixed(2)),
    profileLengthM: profile.lengthM,
    gridRows: innerSamples,
    gridCols: innerSamples,
    contourSegments: contourSegmentsCount,
    studiedAreaM2: Math.round(
      distanceMeters({ lat: bounds.north, lng: bounds.west }, { lat: bounds.north, lng: bounds.east }) *
        distanceMeters({ lat: bounds.north, lng: bounds.west }, { lat: bounds.south, lng: bounds.west }),
    ),
    aroundAreaM2: Math.max(
      0,
      Math.round(
        distanceMeters({ lat: bounds.north, lng: bounds.west }, { lat: bounds.north, lng: bounds.east }) *
          distanceMeters({ lat: bounds.north, lng: bounds.west }, { lat: bounds.south, lng: bounds.west }),
      ) - polygonAreaM2,
    ),
  };

  const heatmap: TerrainHeatmap = {
    rows: aroundSamples,
    cols: aroundSamples,
    values: gridAround.map((row) => row.map((value) => Number(value.toFixed(2)))),
    bounds,
    min: Number(minElevation.toFixed(2)),
    max: Number(maxElevation.toFixed(2)),
  };

  const deltaValues = gridInner.map((row) => row.map((value) => Number((value - targetElevation).toFixed(2))));
  const deltaFlat = deltaValues.flat();
  const cutFillHeatmap: TerrainHeatmap = {
    rows: innerSamples,
    cols: innerSamples,
    values: deltaValues,
    bounds: boundsInner,
    min: Number(Math.min(...deltaFlat).toFixed(2)),
    max: Number(Math.max(...deltaFlat).toFixed(2)),
  };

  const polygonBounds = {
    north: innerNorth,
    south: innerSouth,
    east: innerEast,
    west: innerWest,
  };

  return {
    contours,
    demGrid: {
      values: gridAround.map((row) => row.map((value) => Number(value.toFixed(2)))),
      bounds,
      innerValues: gridInner.map((row) => row.map((value) => Number(value.toFixed(2)))),
      innerBounds: boundsInner,
      polygonBounds,
      boundary,
      min: Number(minElevation.toFixed(2)),
      max: Number(maxElevation.toFixed(2)),
      bufferM: GRID_BUFFER_M,
    },
    stats,
    heatmap,
    cutFillHeatmap,
    profile,
    crossProfile,
    demComparison: comparison,
    gridLines,
    gridInfo,
    grading,
    source,
    effectiveInterval,
    resolution: innerSamples,
  };
}
