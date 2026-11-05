import { getCityMap } from "@/lib/data";
import { findCity, slugifyCity } from "@/lib/cities";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("city") ?? url.searchParams.get("q");
    const cityMap = await getCityMap();
    const list = [...cityMap.values()]
      .map((city) => ({
        ...city,
        density: city.areaKm2 > 0 ? Number((city.population2022 / city.areaKm2).toFixed(1)) : 0,
        growthPct:
          city.population2010 > 0
            ? Number((((city.population2022 - city.population2010) / city.population2010) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    if (!query) {
      return Response.json({ ok: true, cities: list, source: "IBGE — Censo 2022 / Censo 2010 / PNUD IDHM 2010" });
    }

    const normalized = slugifyCity(query);
    const city =
      list.find((item) => item.slug === normalized) ??
      list.find((item) => item.name.toLowerCase() === query.trim().toLowerCase()) ??
      list.find((item) => normalized.length > 3 && item.slug.includes(normalized)) ??
      (() => {
        const match = findCity(query);
        return match ? list.find((item) => item.slug === match.slug) : undefined;
      })();
    if (!city) {
      return Response.json({ ok: false, error: "Município não encontrado na base regional." }, { status: 404 });
    }
    return Response.json({ ok: true, city });
  } catch (error) {
    console.error("[ibge:GET]", error);
    return Response.json({ ok: false, error: "Falha ao consultar indicadores." }, { status: 500 });
  }
}
