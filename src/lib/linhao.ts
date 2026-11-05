import { distanceMeters, ringAreaM2 } from "@/lib/geo";

/**
 * FAIXA DE SERVIDÃO DE LINHÃO — recuos a partir do EIXO
 * ------------------------------------------------------------------
 * Referências: CPFL GED-22 (Ocupação de Faixa de Linha de Transmissão), que
 * define 15 m para cada lado do eixo em linhas de 69/88/138 kV e 10 m para
 * cada lado em 34,5 kV; NBR 5422 (faixas de segurança) e NBR 15688 (redes
 * rurais) para os demais níveis. A faixa é sempre medida DO EIXO para cada lado.
 */

export type LinhaoTemplate = {
  id: string;
  label: string;
  voltageKv: number;
  /** recuo do eixo para cada lado, em metros */
  setbackM: number;
  source: string;
  note: string;
};

export const LINHAO_TEMPLATES: LinhaoTemplate[] = [
  {
    id: "mt-13",
    label: "Rede de distribuição 13,8 kV",
    voltageKv: 13.8,
    setbackM: 5,
    source: "NBR 15688 / padrão de rede aérea urbana",
    note: "faixa total de 10 m (5 m para cada lado do eixo)",
  },
  {
    id: "mt-345",
    label: "Linha 34,5 kV",
    voltageKv: 34.5,
    setbackM: 10,
    source: "CPFL GED-22",
    note: "faixa total de 20 m (10 m para cada lado do eixo)",
  },
  {
    id: "at-69-88-138",
    label: "Linha 69 / 88 / 138 kV",
    voltageKv: 138,
    setbackM: 15,
    source: "CPFL GED-22",
    note: "faixa total de 30 m (15 m para cada lado do eixo)",
  },
  {
    id: "at-230",
    label: "Linha 230 kV",
    voltageKv: 230,
    setbackM: 20,
    source: "NBR 5422 (referência de projeto)",
    note: "faixa total de 40 m (20 m para cada lado do eixo)",
  },
  {
    id: "at-440",
    label: "Linha 440 kV",
    voltageKv: 440,
    setbackM: 30,
    source: "NBR 5422 (referência de projeto)",
    note: "faixa total de 60 m (30 m para cada lado do eixo)",
  },
  {
    id: "custom",
    label: "Recuo personalizado (do eixo)",
    voltageKv: 0,
    setbackM: 15,
    source: "Informado pelo usuário",
    note: "ajuste o recuo conforme o projeto/escritura da servidão",
  },
];

export function templateById(id: string): LinhaoTemplate {
  return LINHAO_TEMPLATES.find((item) => item.id === id) ?? LINHAO_TEMPLATES[2];
}

type Point = { lat: number; lng: number };

const METERS_LAT = 111320;
const metersLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/**
 * Constrói o polígono da faixa de servidão a partir do eixo (polyline),
 * deslocando `setbackM` para cada lado. Joins por média de normais (miter
 * limitado), resultando em um corredor contínuo ao longo de todo o traçado.
 */
export function buildCorridor(axis: [number, number][], setbackM: number): [number, number][] {
  const points = axis.filter((point) => Array.isArray(point) && point.length >= 2);
  if (points.length < 2 || setbackM <= 0) return [];

  const lat0 = points.reduce((sum, [, lat]) => sum + lat, 0) / points.length;
  const lng0 = points.reduce((sum, [lng]) => sum + lng, 0) / points.length;
  const mx = Math.max(1, metersLng(lat0));
  const my = METERS_LAT;

  // projeção local em metros
  const local = points.map(([lng, lat]) => ({ x: (lng - lng0) * mx, y: (lat - lat0) * my }));
  const half = Math.min(200, Math.max(1, setbackM));

  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];

  for (let index = 0; index < local.length; index += 1) {
    const previous = local[index - 1];
    const current = local[index];
    const next = local[index + 1];

    const normals: { x: number; y: number }[] = [];
    if (previous) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const length = Math.hypot(dx, dy) || 1;
      normals.push({ x: -dy / length, y: dx / length });
    }
    if (next) {
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const length = Math.hypot(dx, dy) || 1;
      normals.push({ x: -dy / length, y: dx / length });
    }

    // média das normais (miter), com limite para ângulos muito fechados
    let nx = normals.reduce((sum, normal) => sum + normal.x, 0);
    let ny = normals.reduce((sum, normal) => sum + normal.y, 0);
    const normalLength = Math.hypot(nx, ny) || 1;
    nx /= normalLength;
    ny /= normalLength;
    const cosHalf = Math.max(0.34, Math.abs(nx * normals[0].x + ny * normals[0].y)); // miter limit ~3x
    const offset = half / cosHalf;

    left.push({ x: current.x + nx * offset, y: current.y + ny * offset });
    right.push({ x: current.x - nx * offset, y: current.y - ny * offset });
  }

  const ring = [...left, ...right.reverse()];
  const coordinates = ring.map((point) => [
    Number((lng0 + point.x / mx).toFixed(7)),
    Number((lat0 + point.y / my).toFixed(7)),
  ] as [number, number]);
  coordinates.push(coordinates[0]);
  return coordinates;
}

export type CorridorResult = {
  polygon: [number, number][];
  areaM2: number;
  lengthM: number;
  setbackM: number;
  widthM: number;
};

/** Calcula o corredor completo (polígono + comprimento do eixo + largura). */
export function corridorFromAxis(axis: [number, number][], setbackM: number): CorridorResult {
  const polygon = buildCorridor(axis, setbackM);
  let lengthM = 0;
  for (let index = 1; index < axis.length; index += 1) {
    lengthM += distanceMeters(
      { lat: axis[index - 1][1], lng: axis[index - 1][0] },
      { lat: axis[index][1], lng: axis[index][0] },
    );
  }
  return {
    polygon,
    areaM2: polygon.length > 2 ? Math.round(ringAreaM2(polygon)) : 0,
    lengthM: Number(lengthM.toFixed(1)),
    setbackM,
    widthM: setbackM * 2,
  };
}

export const LINHAO_TYPE = "linhao";

export function isAxisType(type: string): boolean {
  return type === LINHAO_TYPE;
}

export type AxisMeta = {
  axis: [number, number][];
  setbackM: number;
  widthM: number;
  lengthM: number;
  voltageKv: number;
  standard: string;
  source: string;
};

export function parseAxisMeta(value: unknown): AxisMeta | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const axis = Array.isArray(raw.axis)
    ? (raw.axis as unknown[])
        .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2)
        .map(([lng, lat]) => [Number(lng), Number(lat)] as [number, number])
    : [];
  if (axis.length < 2) return null;
  return {
    axis,
    setbackM: Number(raw.setbackM) || 0,
    widthM: Number(raw.widthM) || 0,
    lengthM: Number(raw.lengthM) || 0,
    voltageKv: Number(raw.voltageKv) || 0,
    standard: typeof raw.standard === "string" ? raw.standard : "",
    source: typeof raw.source === "string" ? raw.source : "",
  };
}
