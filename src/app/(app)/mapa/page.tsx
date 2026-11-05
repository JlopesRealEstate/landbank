import Link from "next/link";
import { Plus } from "lucide-react";
import { getPortfolio } from "@/lib/data";
import { toMapAreas } from "@/lib/map-data";
import { areaLabel, num } from "@/lib/format";
import { Eyebrow } from "@/components/ui";
import { PortfolioWorkspace } from "@/components/map/portfolio-workspace";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const portfolio = await getPortfolio();
  const mapAreas = toMapAreas(portfolio.areas, portfolio.cityMap);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Visualização geográfica</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Mapa interativo do land bank</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {mapAreas.length} pontos mapeados · {areaLabel(portfolio.summary.totalLandM2)} · {portfolio.summary.citiesCount}{" "}
            municípios. Alterne entre mapa, satélite e modo humanitário e maximize para apresentações.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-[10px] text-ink-soft">
            OpenStreetMap · Esri World Imagery · OSM HOT
          </span>
          <Link href="/areas/nova" className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-600">
            <Plus className="h-3.5 w-3.5 text-[#e9b7c1]" /> Nova área / KMZ
          </Link>
        </div>
      </div>

      <PortfolioWorkspace
        areas={mapAreas}
        height={640}
        showFilters
        title="Apresentação geográfica do portfólio"
        subtitle="Filtre por município, tipo e status · clique nos pontos para abrir o resumo e os dados IBGE"
        cities={portfolio.cities
          .filter((city) => portfolio.summary.cityCounts.some((item) => item.city === city.name))
          .map((city) => ({ slug: city.slug, name: city.name }))}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {portfolio.summary.cityCounts.slice(0, 4).map((item) => {
          const city = portfolio.cityMap.get(
            portfolio.areas.find((area) => area.city === item.city)?.citySlug ?? "",
          );
          return (
            <div key={item.city} className="rounded-xl border border-line bg-white p-3">
              <p className="text-xs font-semibold text-ink">{item.city}</p>
              <p className="mt-0.5 text-[10px] text-muted">
                {item.count} ativo(s) · {areaLabel(item.landM2)}
              </p>
              {city ? (
                <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] text-muted">
                  <div>
                    <p className="uppercase tracking-[0.06em]">pop.</p>
                    <p className="text-[10px] font-semibold text-ink-soft">{num(city.population2022)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.06em]">IDHM</p>
                    <p className="text-[10px] font-semibold text-ink-soft">{city.idhm.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.06em]">solo</p>
                    <p className="text-[10px] font-semibold text-ink-soft">{num(city.marketPriceM2)}/m²</p>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
