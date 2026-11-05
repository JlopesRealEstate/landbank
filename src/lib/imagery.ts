/**
 * IMAGEM REAL DO IMÓVEL (servidor) — Esri World Imagery, sem chave de API.
 * Usada na ficha PDF para embutir a foto do imóvel como data URL.
 */
/**
 * Normaliza coordenadas para { lat, lng }. Aceita GeoJSON [lng, lat] (padrão do
 * banco) ou [lat, lng], decidindo pelo enquadramento do Estado de São Paulo.
 */
function normalizePoints(raw: [number, number][][]): { lat: number; lng: number }[] {
  const pairs = raw.flat().filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
  if (!pairs.length) return [];
  const inSP = (lat: number, lng: number) => lat >= -25.6 && lat <= -19.4 && lng >= -53.6 && lng <= -43.4;
  const first = pairs[0];
  // GeoJSON: [lng, lat]
  const geoJsonFits = inSP(first[1], first[0]);
  const latLngFits = inSP(first[0], first[1]);
  const asGeoJson = geoJsonFits || !latLngFits;
  return pairs.map(([a, b]) => (asGeoJson ? { lat: b, lng: a } : { lat: a, lng: b }));
}

export type PropertyImageryResult = {
  dataUrl: string;
  bounds: { north: number; south: number; east: number; west: number };
};

export async function fetchPropertyImageryWithBounds(input: {
  lat: number;
  lng: number;
  geometry?: [number, number][][];
  width?: number;
  height?: number;
  paddingPct?: number;
}): Promise<PropertyImageryResult | null> {
  const width = Math.min(1600, Math.max(320, Math.round(input.width ?? 900)));
  const height = Math.min(1200, Math.max(220, Math.round(input.height ?? 380)));
  const paddingPct = Math.min(120, Math.max(0, input.paddingPct ?? 40));
  const points = normalizePoints(input.geometry ?? []);
  const all = points.length ? points : [{ lat: input.lat, lng: input.lng }];

  const north = Math.max(...all.map((point) => point.lat));
  const south = Math.min(...all.map((point) => point.lat));
  const east = Math.max(...all.map((point) => point.lng));
  const west = Math.min(...all.map((point) => point.lng));
  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;

  const minSpanLat = 160 / 111320;
  const minSpanLng = 160 / (111320 * Math.cos((centerLat * Math.PI) / 180) || 1);
  const pad = paddingPct / 100;
  const spanLat = Math.max(north - south, minSpanLat) * (1 + pad);
  const spanLng = Math.max(east - west, minSpanLng) * (1 + pad);

  const aspect = width / height;
  let spanLatFinal = spanLat;
  let spanLngFinal = spanLng;
  if (spanLng / spanLat < aspect) spanLngFinal = spanLat * aspect;
  else spanLatFinal = spanLng / aspect;

  const bbox = [
    centerLng - spanLngFinal / 2,
    centerLat - spanLatFinal / 2,
    centerLng + spanLngFinal / 2,
    centerLat + spanLatFinal / 2,
  ];

  const url =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
    `?bbox=${bbox.join(",")}&bboxSR=4326&imageSR=4326&size=${width},${height}` +
    "&format=jpg&f=image&interpolation=RSP_BilinearInterpolation&dpi=96";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LandBankCorpCRM/2.0 (junior.lopes@creci.org.br)", Accept: "image/jpeg" },
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      dataUrl: `data:${response.headers.get("content-type") ?? "image/jpeg"};base64,${buffer.toString("base64")}`,
      bounds: {
        north: bbox[3],
        south: bbox[1],
        east: bbox[2],
        west: bbox[0],
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Compatibilidade: retorna apenas o data URL. */
export async function fetchPropertyImagery(input: {
  lat: number;
  lng: number;
  geometry?: [number, number][][];
  width?: number;
  height?: number;
  paddingPct?: number;
}): Promise<string | null> {
  const result = await fetchPropertyImageryWithBounds(input);
  return result ? result.dataUrl : null;
}
