import { getPortfolio } from "@/lib/data";
import { Card, Eyebrow, SectionTitle } from "@/components/ui";
import { CityExplorer, type CityAreaSummary } from "@/components/indicators/city-explorer";
import { brl, num } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IndicatorsPage() {
  const portfolio = await getPortfolio();
  const cities = [...portfolio.cityMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const areasByCity: Record<string, CityAreaSummary[]> = {};
  for (const area of portfolio.areas) {
    const list = areasByCity[area.citySlug] ?? [];
    list.push({
      id: area.id,
      code: area.code,
      name: area.name,
      status: area.status,
      landAreaM2: area.landAreaM2,
      pricePerM2: area.pricePerM2,
      totalPrice: area.totalPrice,
    });
    areasByCity[area.citySlug] = list;
  }

  const totalPopulation = cities
    .filter((city) => city.slug !== "sao-paulo" && city.slug !== "sorocaba" && city.slug !== "jundiai")
    .reduce((sum, city) => sum + city.population2022, 0);
  const avgIncome =
    cities.filter((city) => (areasByCity[city.slug]?.length ?? 0) > 0).reduce((sum, city) => sum + city.avgIncome, 0) /
    Math.max(1, cities.filter((city) => (areasByCity[city.slug]?.length ?? 0) > 0).length);

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Base regional · São Paulo</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Indicadores IBGE das cidades</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          População, renda, IDHM, PIB, densidade e benchmark de solo dos municípios de atuação — Sumaré, Região
          Metropolitana de Campinas e Piracicaba. Ao importar um KMZ, esses dados são vinculados automaticamente ao imóvel.
        </p>
      </div>

      <Card className="p-3">
        <p className="text-[11px] leading-relaxed text-ink-soft">
          <strong>Base estadual completa:</strong> {cities.length} municípios de São Paulo disponíveis para cadastro, com
          código IBGE e coordenadas oficiais. Os municípios da área de atuação (Sumaré, RMC e Piracicaba) já vêm com
          população, renda, IDHM e benchmark de solo; os demais podem ser enriquecidos via IBGE
          (<code className="rounded bg-paper px-1">POST /api/ibge/sync</code>).
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Municípios na base", value: num(cities.length), hint: "RMC, RMP e referências" },
          { label: "População somada", value: num(totalPopulation), hint: "municípios da área de atuação" },
          { label: "Renda média (cidades com ativos)", value: brl(avgIncome), hint: "referência Censo 2022" },
          { label: "Ativos vinculados", value: num(portfolio.summary.totalAreas), hint: `${portfolio.summary.citiesCount} municípios` },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums">{item.value}</p>
            <p className="text-[10px] text-muted">{item.hint}</p>
          </Card>
        ))}
      </div>

      <CityExplorer cities={cities} areasByCity={areasByCity} />

      <Card className="p-4 sm:p-5">
        <SectionTitle
          eyebrow="Metodologia"
          title="Como os dados são utilizados"
          description="Transparência para apresentações a clientes, bancos e investidores."
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-paper/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Fontes oficiais</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              População do Censo 2022 e evolução desde 2010 (IBGE), PIB municipal (IBGE Cidades), IDHM (PNUD/2010) e
              localização oficial dos municípios.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Benchmark de solo</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Referência interna Land Bank Corp de R$/m² para terrenos industriais e logísticos, revisada pelo time de
              inteligência e comparada ao preço pedido de cada ativo.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Enriquecimento automático</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              A importação de KMZ identifica o ponto central, cruza o município com a base regional e vincula os indicadores
              ao dossiê do imóvel, com bairro e CEP quando disponíveis.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
