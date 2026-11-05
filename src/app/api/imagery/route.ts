import { distanceMeters } from "@/lib/geo";

export const dynamic = "force-dynamic";

/**
 * IMAGEM REAL DO IMÓVEL — sem chave de API.
 * Usa o serviço público de imagens de satélite da Esri (World Imagery), o mesmo
 * provedor do basemap "Satélite" do CRM. Retorna um JPEG do recorte exato do
 * imóvel para foto de apresentação, ficha PDF e Street View substituto.
 */

type Bounds = { north: number; south: number; east: number; west: number };

/** Aceita pontos "a,b" em qualquer ordem e normaliza pelo enquadramento de SP. */
function parsePoints(raw: string | null): { lat: number; lng: number }[] {
  if (!raw) return [];
  const pairs = raw
    .split(";")
    .map((pair) => pair.split(",").map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite)) as [number, number][];
  if (!pairs.length) return [];
  const inSP = (lat: number, lng: number) => lat >= -25.6 && lat <= -19.4 && lng >= -53.6 && lng <= -43.4;
  const first = pairs[0];
  const geoJsonFits = inSP(first[1], first[0]);
  const latLngFits = inSP(first[0], first[1]);
  const asGeoJson = geoJsonFits || !latLngFits;
  return pairs.map(([a, b]) => (asGeoJson ? { lat: b, lng: a } : { lat: a, lng: b }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const width = Math.min(1600, Math.max(320, Math.round(Number(url.searchParams.get("w")) || 960)));
  const height = Math.min(1200, Math.max(220, Math.round(Number(url.searchParams.get("h")) || 480)));
  const paddingPct = Math.min(120, Math.max(0, Number(url.searchParams.get("pad")) || 35));
  const points = parsePoints(url.searchParams.get("pts"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ ok: false, error: "Coordenadas inválidas." }, { status: 400 });
  }

  const all: { lat: number; lng: number }[] = points.length ? points : [{ lat, lng }];
  const north = Math.max(...all.map((point) => point.lat));
  const south = Math.min(...all.map((point) => point.lat));
  const east = Math.max(...all.map((point) => point.lng));
  const west = Math.min(...all.map((point) => point.lng));

  // enquadramento mínimo para terrenos muito pequenos (≈160 m de lado)
  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;
  const minSpanLat = 160 / 111320;
  const minSpanLng = 160 / (111320 * Math.cos((centerLat * Math.PI) / 180) || 1);
  const rawSpanLat = Math.max(north - south, minSpanLat);
  const rawSpanLng = Math.max(east - west, minSpanLng);
  const pad = paddingPct / 100;
  const spanLat = rawSpanLat * (1 + pad);
  const spanLng = rawSpanLng * (1 + pad);

  const aspect = width / height;
  let bboxSpanLat = spanLat;
  let bboxSpanLng = spanLng;
  const currentAspect = spanLng / spanLat;
  if (currentAspect < aspect) bboxSpanLng = spanLat * aspect;
  else bboxSpanLat = spanLng / aspect;

  const bbox = [centerLng - bboxSpanLng / 2, centerLat - bboxSpanLat / 2, centerLng + bboxSpanLng / 2, centerLat + bboxSpanLat / 2];

  const exportUrl =
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
    `?bbox=${bbox.join(",")}&bboxSR=4326&imageSR=4326&size=${width},${height}` +
    "&format=jpg&f=image&interpolation=RSP_BilinearInterpolation&dpi=96";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(exportUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "LandBankCorpCRM/2.0 (junior.lopes@creci.org.br)", Accept: "image/jpeg,image/png" },
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return Response.json({ ok: false, error: "Serviço de imagens indisponível." }, { status: 502 });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const bytes = new Uint8Array(buffer);

    // metragens úteis para a legenda da foto
    const widthM = Math.round(
      distanceMeters({ lat: centerLat, lng: bbox[0] }, { lat: centerLat, lng: bbox[2] }),
    );
    const heightM = Math.round(
      distanceMeters({ lat: bbox[1], lng: centerLng }, { lat: bbox[3], lng: centerLng }),
    );

    return new Response(bytes, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Imagery-Bounds": bbox.map((value) => value.toFixed(6)).join(","),
        "X-Imagery-Meters": `${widthM}x${heightM}`,
        "X-Imagery-Attribution": "Imagens © Esri, Maxar, Earthstar Geographics",
      },
    });
  } catch (error) {
    console.error("[imagery]", error);
    return Response.json({ ok: false, error: "Falha ao obter a imagem do imóvel." }, { status: 500 });
  }
}
