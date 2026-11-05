export type ReverseGeocodeResult = {
  city: string;
  neighborhood: string;
  road: string;
  postcode: string;
  state: string;
  source: string;
};

/**
 * Geocodificação reversa pública (Nominatim/OSM) para pré-preencher cidade e bairro
 * ao importar um KMZ. Se o serviço estiver indisponível, o usuário escolhe a cidade
 * manualmente e os indicadores do IBGE são vinculados pela base regional local.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("accept-language", "pt-BR");
    url.searchParams.set("zoom", "14");
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      address?: Record<string, string>;
    };
    const address = data.address ?? {};
    const city =
      address.city ?? address.town ?? address.municipality ?? address.village ?? address.county ?? "";
    const neighborhood = address.suburb ?? address.neighbourhood ?? address.city_district ?? "";
    return {
      city,
      neighborhood,
      road: address.road ?? "",
      postcode: address.postcode ?? "",
      state: address.state ?? "São Paulo",
      source: "Nominatim / OpenStreetMap",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
