import type { City } from "@/db/schema";
import { LOGISTIC_HUBS } from "@/lib/cities";
import { isMarketEligibleKind } from "@/lib/format";
import { distanceKm } from "@/lib/geo";

/**
 * AUDITORIA DE RENDA, CONSUMO E BENCHMARK — Land Bank Corp
 * ------------------------------------------------------------------
 * Renda média mensal per capita: base IBGE Censo 2022 (rendimento nominal
 * mensal domiciliar per capita) / PNAD Contínua para os municípios da RMC/RMP.
 * Renda mediana: estimada pela razão median/mean observada na região
 * (0,66 a 0,70 em municípios paulistas) — sempre exibida como estimativa.
 * Potencial de consumo anual = população × renda média × 12 (renda total anual).
 * Benchmark de solo = preço de referência interno de terreno industrial/logístico
 * em R$/m², calibrado por vetor logístico (distância a hubs), grau de urbanização
 * e porte econômico (PIB per capita). Confiança alta quando o município é
 * acompanhado pelo time de inteligência; média/baixa caso contrário.
 */

export const INCOME_METHOD = {
  source: "IBGE — Censo 2022 (rendimento domiciliar per capita) / PNAD Contínua",
  medianRatio: 0.68,
  medianRatioRange: [0.66, 0.7] as [number, number],
  consumptionFormula: "população × renda média mensal × 12",
  note:
    "Renda média e mediana são mensais por pessoa. Municípios da área de atuação usam o valor medido do Censo 2022; os demais usam estimativa calibrada por PIB per capita e IDHM (faixa R$ 1.350–3.400). O potencial de consumo é a massa de renda anual do município e deve ser lido como teto de mercado, não como demanda endereçável.",
};

export type IncomeAudit = {
  avgIncome: number;
  formalMinWages: number;
  formalAvgSalary: number;
  medianIncome: number;
  medianRatio: number;
  consumptionPotential: number;
  consumptionPerCapita: number;
  population: number;
  source: string;
  confidence: "alta" | "média" | "baixa";
  hasData: boolean;
};

export function auditIncome(city: City): IncomeAudit {
  const population = city.population2022;
  const avgIncome = city.avgIncome;
  const stored = city.medianIncome ?? 0;
  const medianIncome = stored > 0 ? stored : Math.round(avgIncome * INCOME_METHOD.medianRatio);
  const consumptionPotential =
    city.consumptionPotential && city.consumptionPotential > 0
      ? city.consumptionPotential
      : population * avgIncome * 12;
  const ratio = avgIncome > 0 ? medianIncome / avgIncome : 0;

  const hasData = population > 0 && avgIncome > 0;
  const confidence: IncomeAudit["confidence"] = !hasData ? "baixa" : ratio >= 0.6 && ratio <= 0.8 ? "alta" : "média";

  return {
    avgIncome,
    formalMinWages: city.formalMinWages ?? 0,
    formalAvgSalary: city.formalAvgSalary ?? 0,
    medianIncome,
    medianRatio: Number(ratio.toFixed(3)),
    consumptionPotential,
    consumptionPerCapita: population > 0 ? Math.round(consumptionPotential / population) : 0,
    population,
    source: INCOME_METHOD.source,
    confidence,
    hasData,
  };
}

export type BenchmarkFactor = { label: string; impact: number; detail: string };

export type BenchmarkAudit = {
  reference: number;
  adjusted: number;
  factors: BenchmarkFactor[];
  confidence: "alta" | "média" | "baixa";
  distanceToViracoposKm: number | null;
  methodology: string;
  portfolioAvg: number;
  portfolioSamples: number;
  portfolioDeviationPct: number;
  alert: string | null;
};

/** Benchmark municipal de solo (R$/m²) com fatores explícitos e rastreáveis. */
export function auditBenchmark(
  city: City,
  point?: { lat: number; lng: number },
  portfolioPrices: number[] = [],
): BenchmarkAudit {
  const reference = city.marketPriceM2 || 0;
  const factors: BenchmarkFactor[] = [];

  const viracopos = LOGISTIC_HUBS[1];
  const campinas = LOGISTIC_HUBS[0];
  const distanceViracopos = point ? distanceKm(point, viracopos) : null;
  const distanceCampinas = point ? distanceKm(point, campinas) : null;

  let adjusted = reference;

  if (reference > 0 && distanceViracopos !== null) {
    const logisticsImpact = distanceViracopos <= 25 ? 0.06 : distanceViracopos >= 60 ? -0.05 : 0;
    if (logisticsImpact !== 0) {
      adjusted *= 1 + logisticsImpact;
      factors.push({
        label: "Vetor logístico (Viracopos)",
        impact: logisticsImpact,
        detail: `${distanceViracopos} km do aeroporto de Viracopos`,
      });
    }
  }

  if (reference > 0 && city.urbanization > 0) {
    const urbanizationImpact = city.urbanization >= 95 ? 0.03 : city.urbanization < 85 ? -0.04 : 0;
    if (urbanizationImpact !== 0) {
      adjusted *= 1 + urbanizationImpact;
      factors.push({
        label: "Grau de urbanização",
        impact: urbanizationImpact,
        detail: `${city.urbanization.toFixed(1)}% de urbanização`,
      });
    }
  }

  if (reference > 0 && city.gdpPerCapita > 0) {
    const gdpImpact = city.gdpPerCapita >= 60000 ? 0.04 : city.gdpPerCapita < 30000 ? -0.05 : 0;
    if (gdpImpact !== 0) {
      adjusted *= 1 + gdpImpact;
      factors.push({
        label: "Porte econômico (PIB per capita)",
        impact: gdpImpact,
        detail: `R$ ${Math.round(city.gdpPerCapita).toLocaleString("pt-BR")} por habitante`,
      });
    }
  }

  const samples = portfolioPrices.filter((price) => price > 0);
  const portfolioAvg = samples.length ? samples.reduce((sum, price) => sum + price, 0) / samples.length : 0;
  const portfolioDeviationPct =
    reference > 0 && portfolioAvg > 0 ? ((portfolioAvg - reference) / reference) * 100 : 0;

  const confidence: BenchmarkAudit["confidence"] =
    reference <= 0 ? "baixa" : samples.length >= 2 && factors.length >= 1 ? "alta" : "média";

  let alert: string | null = null;
  if (reference <= 0) alert = "Município sem benchmark calibrado — usar referência da região até revisão.";
  else if (samples.length >= 2 && Math.abs(portfolioDeviationPct) > 35) {
    alert = `Portfólio ${portfolioDeviationPct >= 0 ? "acima" : "abaixo"} do benchmark em ${Math.abs(
      portfolioDeviationPct,
    ).toFixed(0)}% — revisar avaliação antes de apresentar.`;
  } else if (factors.length === 0 && samples.length < 2) {
    alert = "Confiança média: benchmark sem amostra de portfólio para validar.";
  }

  return {
    reference,
    adjusted: Math.round(adjusted),
    factors,
    confidence,
    distanceToViracoposKm: distanceViracopos,
    distanceToCampinasKm: distanceCampinas,
    methodology:
      "Benchmark de solo = R$/m² de referência municipal ajustado por vetor logístico (≤25 km de Viracopos +6%; ≥60 km −5%), urbanização (≥95% +3%; <85% −4%) e PIB per capita (≥R$ 60 mil +4%; <R$ 30 mil −5%).",
    portfolioAvg: Math.round(portfolioAvg),
    portfolioSamples: samples.length,
    portfolioDeviationPct: Number(portfolioDeviationPct.toFixed(1)),
    alert,
  } as BenchmarkAudit & { distanceToCampinasKm: number | null };
}

export type MarketRow = {
  label: string;
  product: string;
  transaction: string;
  unit: string;
  count: number;
  landM2: number;
  builtM2: number;
  avgPriceM2: number;
  minPriceM2: number;
  maxPriceM2: number;
  vgv: number;
  benchmark: number;
  deltaPct: number;
};

/**
 * Tabela de M² da região — sempre separada por transação (venda × locação) e por
 * produto (terreno/gleba × galpão). Imóveis residenciais (uso misto/residencial)
 * são excluídos: a análise compara apenas o mesmo produto.
 */
export function buildMarketTable(
  areas: {
    city: string;
    neighborhood: string;
    kind: string;
    transaction?: string;
    landAreaM2: number;
    builtAreaM2: number;
    pricePerM2: number;
    totalPrice: number;
  }[],
  cityBenchmark: Map<string, number>,
  groupBy: "neighborhood" | "product",
  transaction: "venda" | "locacao" = "venda",
): MarketRow[] {
  const buckets = new Map<string, MarketRow & { benchmarkSum: number; benchmarkCount: number }>();

  for (const area of areas) {
    if (area.pricePerM2 <= 0) continue;
    if (!isMarketEligibleKind(area.kind)) continue; // fora: residencial / uso misto
    if ((area.transaction ?? "venda") !== transaction) continue; // sempre separar venda e locação
    const product = area.kind === "galpao" ? "Galpão / logística" : "Terreno / gleba";
    const label = groupBy === "product" ? product : area.neighborhood || area.city;
    const key = groupBy === "product" ? `${product}::${transaction}` : `${area.city}::${label}::${product}::${transaction}`;
    const current =
      buckets.get(key) ??
      ({
        label,
        product,
        transaction,
        unit: transaction === "locacao" ? "R$/m²/mês" : "R$/m²",
        count: 0,
        landM2: 0,
        builtM2: 0,
        avgPriceM2: 0,
        minPriceM2: Number.POSITIVE_INFINITY,
        maxPriceM2: 0,
        vgv: 0,
        benchmark: 0,
        deltaPct: 0,
        benchmarkSum: 0,
        benchmarkCount: 0,
      } as MarketRow & { benchmarkSum: number; benchmarkCount: number });

    current.count += 1;
    current.landM2 += area.landAreaM2;
    current.builtM2 += area.builtAreaM2;
    current.vgv += area.totalPrice;
    current.avgPriceM2 += area.pricePerM2;
    current.minPriceM2 = Math.min(current.minPriceM2, area.pricePerM2);
    current.maxPriceM2 = Math.max(current.maxPriceM2, area.pricePerM2);
    const benchmark = cityBenchmark.get(area.city) ?? 0;
    if (benchmark > 0) {
      current.benchmarkSum += benchmark;
      current.benchmarkCount += 1;
    }
    buckets.set(key, current);
  }

  return [...buckets.values()]
    .map((row) => {
      const avg = row.avgPriceM2 / row.count;
      const benchmark = row.benchmarkCount ? Math.round(row.benchmarkSum / row.benchmarkCount) : 0;
      return {
        ...row,
        avgPriceM2: Math.round(avg),
        minPriceM2: Number.isFinite(row.minPriceM2) ? Math.round(row.minPriceM2) : 0,
        benchmark,
        deltaPct: benchmark > 0 ? Number((((avg - benchmark) / benchmark) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => (a.product === b.product ? b.avgPriceM2 - a.avgPriceM2 : a.product.localeCompare(b.product)));
}
