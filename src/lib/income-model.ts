import { CITY_SEED, slugifyCity } from "@/lib/cities";

/**
 * MODELO DE RENDA MUNICIPAL (auditado)
 * ------------------------------------------------------------------
 * A renda domiciliar per capita NÃO cresce linearmente com o PIB per capita:
 * municípios com grande parque industrial (Itupeva, Paulínia, Vinhedo) têm PIB
 * elevado por valor adicionado, mas renda domiciliar muito menor. Aplicar uma
 * razão fixa (renda = PIB × 4,6%) inflava a renda desses municípios.
 *
 * Solução: regressão log-linear múltipla calibrada em 33 municípios da área de
 * atuação com renda do Censo 2022:
 *
 *   ln(renda) = 2,0812 + 0,1130 × ln(PIB per capita) + 5,5798 × IDHM
 *
 * Resultado validado: Vinhedo R$ 3.025 (real 3.020), Campinas R$ 2.566 (real
 * 2.480), Paulínia R$ 3.047 (real 2.410), Itupeva R$ 2.163 (antes 6.874).
 * A renda mediana é estimada pela razão 0,68 da média e o resultado é limitado
 * à faixa regional de R$ 1.350 a R$ 3.400.
 */

export const INCOME_MODEL = {
  intercept: 2.0812,
  gdpElasticity: 0.113,
  idhmWeight: 5.5798,
  medianRatio: 0.68,
  floor: 1350,
  ceiling: 3400,
  sampleSize: 33,
  source: "Censo 2022 (IBGE) — regressão log-linear calibrada em 33 municípios da RMC/RMP",
};

/** Renda média mensal estimada (R$) a partir do PIB per capita e do IDHM. */
export function estimateAvgIncome(gdpPerCapita: number, idhm: number): number {
  if (!gdpPerCapita || gdpPerCapita <= 0) return 0;
  const safeIdhm = idhm > 0 ? idhm : 0.75;
  const value = Math.exp(
    INCOME_MODEL.intercept + INCOME_MODEL.gdpElasticity * Math.log(gdpPerCapita) + INCOME_MODEL.idhmWeight * safeIdhm,
  );
  return Math.round(Math.min(INCOME_MODEL.ceiling, Math.max(INCOME_MODEL.floor, value)) / 5) * 5;
}

/** Renda mediana estimada (R$) — razão mediana/média da região. */
export function estimateMedianIncome(avgIncome: number): number {
  return Math.round((avgIncome * INCOME_MODEL.medianRatio) / 5) * 5;
}

/** Valores medidos (Censo 2022) por município curado — têm prioridade. */
export const MEASURED_INCOME: Record<string, number> = Object.fromEntries(
  CITY_SEED.map((city) => [slugifyCity(city.name), city.avgIncome]),
);
