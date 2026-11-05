import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Compass, Sparkles, Target, TrendingUp } from "lucide-react";
import { getPortfolio } from "@/lib/data";
import { buildIntel } from "@/lib/intelligence";
import { areaLabel, brl, num } from "@/lib/format";
import { Bar, Card, Eyebrow, ScorePill, SectionTitle, Stat } from "@/components/ui";
import { auditBenchmark, auditIncome, INCOME_METHOD } from "@/lib/market";
import { FieldHelp } from "@/components/ui/field-help";

export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const portfolio = await getPortfolio();
  const ranked = portfolio.areas
    .map((area) => {
      const city = portfolio.cityMap.get(area.citySlug);
      return {
        area,
        city,
        intel: buildIntel(area, city, { photos: area.photoCount, documents: area.documentCount }),
      };
    })
    .sort((a, b) => b.intel.score - a.intel.score);

  const opportunities = ranked.filter((item) => item.intel.marketDeltaPct <= 0);
  const premium = ranked.filter((item) => item.intel.marketDeltaPct > 12);
  const environmental = ranked.filter((item) => item.area.environmentalRestriction);
  const weakestDossiers = [...ranked].sort((a, b) => b.intel.alerts.length - a.intel.alerts.length).slice(0, 4);

  const cityBenchmark = [...portfolio.cityMap.values()]
    .map((city) => {
      const cityAreas = portfolio.areas.filter((area) => area.citySlug === city.slug);
      const avg =
        cityAreas.length > 0
          ? cityAreas.reduce((sum, area) => sum + area.pricePerM2, 0) / cityAreas.length
          : 0;
      return { city, count: cityAreas.length, avg, delta: city.marketPriceM2 ? ((avg - city.marketPriceM2) / city.marketPriceM2) * 100 : 0 };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const avgScore = ranked.length ? Math.round(ranked.reduce((sum, item) => sum + item.intel.score, 0) / ranked.length) : 0;

  // ---- auditoria de renda, consumo e benchmark (somente municípios com ativos) ----
  const cityAudits = [...portfolio.cityMap.values()]
    .map((city) => {
      const samples = portfolio.areas.filter((area) => area.citySlug === city.slug).map((area) => area.pricePerM2);
      return {
        city,
        income: auditIncome(city),
        benchmark: auditBenchmark(city, undefined, samples),
        assets: samples.length,
      };
    })
    .filter((item) => item.assets > 0)
    .sort((a, b) => b.income.consumptionPotential - a.income.consumptionPotential);

  const totalConsumption = cityAudits.reduce((sum, item) => sum + item.income.consumptionPotential, 0);
  const totalPopulation = cityAudits.reduce((sum, item) => sum + item.income.population, 0);
  const weightedAvgIncome = totalPopulation > 0 ? cityAudits.reduce((sum, item) => sum + item.income.avgIncome * item.income.population, 0) / totalPopulation : 0;
  const weightedMedianIncome = totalPopulation > 0 ? cityAudits.reduce((sum, item) => sum + item.income.medianIncome * item.income.population, 0) / totalPopulation : 0;
  const weightedFormalWages = totalPopulation > 0
    ? cityAudits.reduce((sum, item) => sum + item.income.formalMinWages * item.income.population, 0) / totalPopulation
    : 0;
  const weightedFormalSalary = totalPopulation > 0
    ? cityAudits.reduce((sum, item) => sum + item.income.formalAvgSalary * item.income.population, 0) / totalPopulation
    : 0;
  const benchmarkAlerts = cityAudits.filter((item) => item.benchmark.alert);

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Motor de decisão</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Inteligência de portfólio</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Leitura proprietária sobre preço, logística, risco e completude dos dossiês. O Land Score combina dados do IBGE,
          benchmark regional de solo, distância a hubs logísticos e qualidade documental de cada ativo.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Land Score médio" value={`${avgScore}/100`} sub={`${ranked.filter((item) => item.intel.score >= 75).length} ativos acima de 75`} icon={<TrendingUp className="h-4 w-4" />} tone="lime" />
        <Stat label="Abaixo do benchmark" value={num(opportunities.length)} sub="ativos com espaço de arbitragem" icon={<Target className="h-4 w-4" />} />
        <Stat label="Preço premium" value={num(premium.length)} sub="ativos 12%+ acima do benchmark" icon={<Compass className="h-4 w-4" />} />
        <Stat label="Restrição ambiental" value={num(environmental.length)} sub="exigem estruturação prévia" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-4 sm:p-5">
          <SectionTitle
            eyebrow="Ranking"
            title="Oportunidades priorizadas"
            description="Ordenadas pelo Land Score: mercado, logística, preço, aproveitamento, risco e dossiê."
          />
          <div className="mt-4 space-y-3">
            {ranked.map(({ area, intel, city }) => (
              <div key={area.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {area.code} · {area.city}
                    </p>
                    <Link href={`/areas/${area.id}`} className="text-sm font-semibold text-ink hover:text-leaf-600">
                      {area.name}
                    </Link>
                    <p className="text-[10px] text-muted">
                      {areaLabel(area.landAreaM2)} · {brl(area.pricePerM2)}/m² · total {brl(area.totalPrice, { compact: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScorePill score={intel.score} grade={intel.grade} />
                    <Link href={`/areas/${area.id}`} className="rounded-lg border border-line p-1.5 text-ink-soft hover:border-leaf hover:text-leaf-600">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {intel.pillars.slice(0, 3).map((pillar) => (
                    <div key={pillar.key}>
                      <div className="flex items-baseline justify-between gap-1">
                        <p className="text-[9px] uppercase tracking-[0.06em] text-muted">{pillar.label}</p>
                        <p className="text-[9px] font-semibold tabular-nums">{pillar.score}</p>
                      </div>
                      <Bar value={pillar.score} max={100} tone={pillar.score >= 65 ? "leaf" : "amber"} />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-ink-soft">
                  {intel.insights[0]}
                  {city ? ` Benchmark ${brl(city.marketPriceM2)}/m² em ${city.name}.` : ""}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-leaf" />
              <h3 className="text-sm font-semibold">Recomendações do motor</h3>
            </div>
            <ul className="mt-2.5 space-y-2 text-[11px] leading-relaxed text-ink-soft">
              {opportunities.length ? (
                <li className="rounded-lg bg-leaf-50 p-2.5">
                  <strong className="text-leaf-600">Priorize {opportunities.length} ativo(s) abaixo do benchmark</strong> em
                  reuniões comerciais: a arbitragem de preço é o argumento mais forte para investidores.
                </li>
              ) : null}
              {premium.length ? (
                <li className="rounded-lg bg-amber-50 p-2.5">
                  <strong className="text-amber-800">Prepare laudos de valor</strong> para {premium.length} ativo(s) com
                  preço premium, evitando objeções de preço na mesa.
                </li>
              ) : null}
              {environmental.length ? (
                <li className="rounded-lg bg-amber-50 p-2.5">
                  <strong className="text-amber-800">Antecipe due diligence ambiental</strong> em{" "}
                  {environmental.map((item) => item.area.code).join(", ")}. APP, dutos e licenciamento podem travar a venda.
                </li>
              ) : null}
              <li className="rounded-lg bg-paper/70 p-2.5">
                Fortaleça dossiês com KMZ e fotos: ativos com dossiê completo recebem até 10 pontos adicionais no score.
              </li>
              <li className="rounded-lg bg-paper/70 p-2.5">
                Concentração regional atual: {portfolio.summary.cityCounts[0]?.city} responde por{" "}
                {num(((portfolio.summary.cityCounts[0]?.landM2 ?? 0) / Math.max(1, portfolio.summary.totalLandM2)) * 100)}% da
                área mapeada — diversifique para reduzir risco de portfólio.
              </li>
            </ul>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Dossiês a completar</h3>
            </div>
            <div className="mt-2.5 space-y-2">
              {weakestDossiers.map(({ area, intel }) => (
                <div key={area.id} className="rounded-lg border border-line p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-ink">{area.code}</p>
                    <p className="text-[9px] text-muted">{intel.alerts.length} pendência(s)</p>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted">{intel.alerts[0] ?? "Dossiê completo."}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Potencial de consumo anual" value={brl(totalConsumption, { compact: true })} sub={`${num(totalPopulation)} habitantes na área de atuação`} tone="lime" />
          <Stat label="Renda média ponderada" value={brl(Math.round(weightedAvgIncome))} sub="mensal por pessoa · Censo 2022" />
          <Stat
            label="Salário formal médio"
            value={brl(Math.round(weightedFormalSalary))}
            sub={`${num(weightedFormalWages, 2)} salários mínimos · piso SP ${brl(1874.36)}`}
          />
          <Stat label="Renda mediana ponderada" value={brl(Math.round(weightedMedianIncome))} sub={`razão mediana/média ${INCOME_METHOD.medianRatio}`} />
          <Stat label="Alertas de benchmark" value={num(benchmarkAlerts.length)} sub={`${cityAudits.length} municípios auditados`} />
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <SectionTitle
                eyebrow="Auditoria de renda e consumo"
                title="Renda média, mediana e potencial de consumo"
                description="Valores conferidos município a município, com razão mediana/média e massa de renda anual."
              />
              <div className="flex shrink-0 gap-1">
                <FieldHelp helpKey="inteligencia.avgIncome" label="Renda média" align="right" />
                <FieldHelp helpKey="inteligencia.consumption" label="Potencial de consumo" align="right" />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[11px]">
              <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Município</th>
                  <th className="px-3 py-2 font-semibold">População</th>
                  <th className="px-3 py-2 font-semibold">Renda média</th>
                  <th className="px-3 py-2 font-semibold">Salário formal</th>
                  <th className="px-3 py-2 font-semibold">Renda mediana</th>
                  <th className="px-3 py-2 font-semibold">Mediana/média</th>
                  <th className="px-3 py-2 font-semibold">Potencial de consumo/ano</th>
                  <th className="px-3 py-2 font-semibold">Confiança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {cityAudits.map(({ city, income }) => (
                  <tr key={city.slug} className="hover:bg-paper/40">
                    <td className="px-4 py-2 font-medium text-ink">{city.name}</td>
                    <td className="px-3 py-2 tabular-nums">{num(income.population)}</td>
                    <td className="px-3 py-2 tabular-nums">{brl(income.avgIncome)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {income.formalMinWages > 0 ? (
                        <>
                          <strong className="text-ink">{num(income.formalMinWages, 2)} sal. mín.</strong>
                          <span className="ml-1 text-[9px] text-muted">({brl(income.formalAvgSalary)})</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{brl(income.medianIncome)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{income.medianRatio.toFixed(2)}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{brl(income.consumptionPotential, { compact: true })}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          income.confidence === "alta"
                            ? "rounded-full bg-leaf-50 px-2 py-0.5 text-[9px] font-semibold text-leaf-600"
                            : income.confidence === "média"
                              ? "rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-800"
                              : "rounded-full bg-[#f6e8eb] px-2 py-0.5 text-[9px] font-semibold text-[#8c2f43]"
                        }
                      >
                        {income.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2 text-[9px] leading-relaxed text-muted">
            {INCOME_METHOD.source}. {INCOME_METHOD.note}
          </p>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <SectionTitle
                eyebrow="Auditoria de benchmark"
                title="Benchmark de solo com fatores rastreáveis"
                description="Referência municipal, ajustes aplicados, confiança e desvio do portfólio."
              />
              <FieldHelp helpKey="inteligencia.benchmark" label="Benchmark de solo" align="right" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-[11px]">
              <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Município</th>
                  <th className="px-3 py-2 font-semibold">Referência</th>
                  <th className="px-3 py-2 font-semibold">Ajustes</th>
                  <th className="px-3 py-2 font-semibold">Benchmark auditado</th>
                  <th className="px-3 py-2 font-semibold">Portfólio</th>
                  <th className="px-3 py-2 font-semibold">Desvio</th>
                  <th className="px-3 py-2 font-semibold">Confiança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {cityAudits.map(({ city, benchmark }) => (
                  <tr key={city.slug} className="align-top hover:bg-paper/40">
                    <td className="px-4 py-2 font-medium text-ink">{city.name}</td>
                    <td className="px-3 py-2 tabular-nums">{benchmark.reference ? brl(benchmark.reference) : "—"}</td>
                    <td className="px-3 py-2">
                      {benchmark.factors.length ? (
                        <ul className="space-y-0.5">
                          {benchmark.factors.map((factor) => (
                            <li key={factor.label} className="text-[9px] text-muted">
                              <strong className={factor.impact >= 0 ? "text-leaf-600" : "text-[#8c2f43]"}>
                                {factor.impact >= 0 ? "+" : ""}
                                {(factor.impact * 100).toFixed(0)}%
                              </strong>{" "}
                              {factor.label} <span className="opacity-70">({factor.detail})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-[9px] text-muted">sem ajustes</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold tabular-nums">{benchmark.adjusted ? `${brl(benchmark.adjusted)}/m²` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {benchmark.portfolioAvg ? `${brl(benchmark.portfolioAvg)}/m²` : "—"}
                      <span className="ml-1 text-[9px] text-muted">({benchmark.portfolioSamples})</span>
                    </td>
                    <td
                      className={
                        benchmark.portfolioDeviationPct <= 0
                          ? "px-3 py-2 font-semibold tabular-nums text-leaf-600"
                          : "px-3 py-2 font-semibold tabular-nums text-[#8c2f43]"
                      }
                    >
                      {benchmark.portfolioAvg ? `${benchmark.portfolioDeviationPct >= 0 ? "+" : ""}${num(benchmark.portfolioDeviationPct)}%` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          benchmark.confidence === "alta"
                            ? "rounded-full bg-leaf-50 px-2 py-0.5 text-[9px] font-semibold text-leaf-600"
                            : "rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-800"
                        }
                      >
                        {benchmark.confidence}
                      </span>
                      {benchmark.alert ? <p className="mt-1 text-[9px] leading-snug text-[#8c2f43]">{benchmark.alert}</p> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2 text-[9px] leading-relaxed text-muted">
            Renda média: IBGE Censo 2022. Salário formal: IBGE CEMPRE 2023 em salários mínimos × piso regional paulista
            vigente (Lei 18.471/2026, R$ 1.874,36).
          </p>
          <p className="border-t border-line px-4 py-2 text-[9px] leading-relaxed text-muted">
            {cityAudits[0]?.benchmark.methodology ??
              "Benchmark de solo = referência municipal ajustada por vetor logístico, urbanização e PIB per capita."}
          </p>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <SectionTitle
            eyebrow="Benchmark"
            title="Preço do portfólio versus mercado local"
            description="Comparativo do R$/m² médio por município com o benchmark interno de solo."
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">Município</th>
                <th className="px-3 py-2 font-semibold">Ativos</th>
                <th className="px-3 py-2 font-semibold">R$/m² médio</th>
                <th className="px-3 py-2 font-semibold">Benchmark</th>
                <th className="px-3 py-2 font-semibold">Diferença</th>
                <th className="px-3 py-2 font-semibold">População</th>
                <th className="px-3 py-2 font-semibold">Renda média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {cityBenchmark.map(({ city, count, avg, delta }) => (
                <tr key={city.slug} className="hover:bg-paper/40">
                  <td className="px-4 py-2.5 font-medium text-ink">{city.name}</td>
                  <td className="px-3 py-2.5">{count}</td>
                  <td className="px-3 py-2.5 tabular-nums">{brl(avg)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted">{brl(city.marketPriceM2)}</td>
                  <td className={`px-3 py-2.5 font-semibold tabular-nums ${delta <= 0 ? "text-leaf-600" : "text-amber-700"}`}>
                    {delta >= 0 ? "+" : ""}
                    {num(delta)}%
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{num(city.population2022)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{brl(city.avgIncome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
