import { distanceMeters } from "@/lib/geo";
import HIGHWAY_DATA from "@/data/highways.json";

/**
 * DISTÂNCIAS A RODOVIAS, CAPITAL, PORTO E AEROPORTOS
 * ------------------------------------------------------------------
 * Geometria REAL das rodovias extraída do OpenStreetMap (Overpass API, dados
 * ODbL) — todos os segmentos de pista (motorway/trunk) do Estado de São Paulo,
 * simplificados com tolerância de ~130 m. A distância do imóvel é a menor
 * distância geodésica até o EIXO da via (ponto de acesso mais próximo).
 *
 * Aeroportos, Porto de Santos e capital usam coordenadas oficiais dos terminais.
 *
 * Natureza da medida: distância em linha reta até o eixo/acesso mais próximo.
 * Para distância rodoviária percorrida, use o botão "rota" (Google Maps).
 */

export type ReferenceKind = "rodovia" | "cidade" | "porto" | "aeroporto";

type HighwayData = {
  source: string;
  pois: {
    id: string;
    name: string;
    short: string;
    kind: ReferenceKind;
    lat: number;
    lng: number;
    note?: string;
  }[];
  highways: {
    id: string;
    name: string;
    short: string;
    note?: string;
    segments: [number, number][][];
  }[];
};

const DATA = HIGHWAY_DATA as HighwayData;

export type ReferenceDistance = {
  id: string;
  name: string;
  short: string;
  kind: ReferenceKind;
  km: number;
  note?: string;
  /** ponto mais próximo no eixo da via / coordenada do terminal */
  nearest: { lat: number; lng: number };
};

const R_EARTH = 6378137;

/** Distância mínima (m) de um ponto até um segmento, com o ponto de projeção. */
function distanceToSegment(
  lat: number,
  lng: number,
  a: [number, number],
  b: [number, number],
): { meters: number; point: [number, number] } {
  const lat0 = (lat * Math.PI) / 180;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos(lat0);

  const ax = (a[0] - lng) * mPerLng;
  const ay = (a[1] - lat) * mPerLat;
  const bx = (b[0] - lng) * mPerLng;
  const by = (b[1] - lat) * mPerLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq)) : 0;
  const px = ax + dx * t;
  const py = ay + dy * t;
  const meters = Math.hypot(px, py);
  return { meters, point: [lng + px / mPerLng, lat + py / mPerLat] };
}

/** Menor distância do ponto ao conjunto de segmentos da rodovia. */
function nearestOnHighway(
  lat: number,
  lng: number,
  segments: [number, number][][],
): { meters: number; point: [number, number] } {
  let best = { meters: Number.POSITIVE_INFINITY, point: [lng, lat] as [number, number] };
  for (const segment of segments) {
    for (let index = 0; index < segment.length - 1; index += 1) {
      const result = distanceToSegment(lat, lng, segment[index], segment[index + 1]);
      if (result.meters < best.meters) best = result;
    }
  }
  if (!Number.isFinite(best.meters)) {
    best = { meters: 0, point: [lng, lat] };
  }
  return best;
}

/**
 * Distâncias (km) do imóvel até cada rodovia (eixo/acesso mais próximo),
 * capital, porto e aeroportos. Ordenadas da mais próxima para a mais distante.
 */
export function distancesToReferences(point: { lat: number; lng: number }): ReferenceDistance[] {
  const highways: ReferenceDistance[] = DATA.highways.map((highway) => {
    const nearest = nearestOnHighway(point.lat, point.lng, highway.segments);
    return {
      id: highway.id,
      name: highway.name,
      short: highway.short,
      kind: "rodovia" as ReferenceKind,
      km: Math.round((nearest.meters / 1000) * 10) / 10,
      note: highway.note,
      nearest: { lat: nearest.point[1], lng: nearest.point[0] },
    };
  });

  const pois: ReferenceDistance[] = DATA.pois.map((poi) => ({
    id: poi.id,
    name: poi.name,
    short: poi.short,
    kind: poi.kind,
    km: Math.round((distanceMeters(point, { lat: poi.lat, lng: poi.lng }) / 1000) * 10) / 10,
    note: poi.note,
    nearest: { lat: poi.lat, lng: poi.lng },
  }));

  return [...highways, ...pois].sort((a, b) => a.km - b.km);
}

export function distanceByKind(list: ReferenceDistance[], kind: ReferenceKind): ReferenceDistance[] {
  return list.filter((item) => item.kind === kind);
}

/** Menor distância por tipo (rodovia, cidade, porto, aeroporto). */
export function nearestByKind(list: ReferenceDistance[]): Partial<Record<ReferenceKind, ReferenceDistance>> {
  const result: Partial<Record<ReferenceKind, ReferenceDistance>> = {};
  for (const item of list) {
    if (!result[item.kind] || item.km < (result[item.kind]?.km ?? Number.POSITIVE_INFINITY)) {
      result[item.kind] = item;
    }
  }
  return result;
}

export const REFERENCE_KIND_LABELS: Record<ReferenceKind, string> = {
  rodovia: "Rodovias (eixo/acesso mais próximo)",
  cidade: "Cidade de referência",
  porto: "Porto",
  aeroporto: "Aeroportos",
};

/** Fontes e método, exibidos no rodapé dos painéis e na documentação. */
export const REFERENCE_METHOD =
  "Rodovias: geometria real do OpenStreetMap (Overpass API, ODbL), menor distância em linha reta até o eixo da pista. Aeroportos, porto e capital: coordenadas oficiais dos terminais. A distância rodoviária percorrida pode ser maior — use o atalho de rota do Google Maps.";

export const REFERENCE_SOURCE = DATA.source;

/** Rótulo do tipo de acesso mais próximo (para resumos e relatórios). */
export function nearestHighway(list: ReferenceDistance[]): ReferenceDistance | undefined {
  return list.filter((item) => item.kind === "rodovia").sort((a, b) => a.km - b.km)[0];
}

/** Compatibilidade: número de arredondamento usado em relatórios. */
export const ROUND_KM = (meters: number) => Math.round((meters / 1000) * 10) / 10;

export const EARTH_RADIUS = R_EARTH;
