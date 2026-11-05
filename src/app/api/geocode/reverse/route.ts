export const dynamic = "force-dynamic";

type CacheEntry = { at: number; value: ReversePayload };
type ReversePayload = {
  city: string;
  neighborhood: string;
  road: string;
  postcode: string;
  state: string;
  displayName: string;
  source: string;
};

const cache = new Map<string, CacheEntry>();
const TTL = 30 * 60 * 1000;

/**
 * Geocodificação reversa no servidor (Nominatim/OSM) — evita CORS no navegador
 * e garante que a cidade do KMZ seja detectada e vinculada automaticamente.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ ok: false, error: "Coordenadas inválidas." }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return Response.json({ ok: true, cached: true, ...hit.value });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const target = new URL("https://nominatim.openstreetmap.org/reverse");
    target.searchParams.set("format", "jsonv2");
    target.searchParams.set("lat", String(lat));
    target.searchParams.set("lon", String(lng));
    target.searchParams.set("accept-language", "pt-BR");
    target.searchParams.set("zoom", "14");
    const response = await fetch(target.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "LandBankCorpCRM/1.3 (junior.lopes@creci.org.br)" },
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) {
      return Response.json({ ok: false, error: "Serviço de geocodificação indisponível." }, { status: 502 });
    }
    const data = (await response.json()) as { address?: Record<string, string>; display_name?: string };
    const address = data.address ?? {};
    const payload: ReversePayload = {
      city: address.city ?? address.town ?? address.municipality ?? address.village ?? address.county ?? "",
      neighborhood: address.suburb ?? address.neighbourhood ?? address.city_district ?? "",
      road: address.road ?? "",
      postcode: address.postcode ?? "",
      state: address.state ?? "São Paulo",
      displayName: data.display_name ?? "",
      source: "Nominatim / OpenStreetMap",
    };
    cache.set(key, { at: Date.now(), value: payload });
    return Response.json({ ok: true, cached: false, ...payload });
  } catch (error) {
    console.error("[geocode:reverse]", error);
    return Response.json({ ok: false, error: "Falha na geocodificação reversa." }, { status: 500 });
  }
}
