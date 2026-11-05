import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema";
import type { City } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { CITY_SEED, slugifyCity } from "@/lib/cities";
import SP_MUNICIPALITIES from "@/data/sp-municipalities.json";
import SP_IBGE_INDICATORS from "@/data/sp-ibge-indicators.json";
import { estimateAvgIncome, estimateMedianIncome, INCOME_MODEL, MEASURED_INCOME } from "@/lib/income-model";
import { wagesToBrl } from "@/lib/minimum-wage";

type SpIndicator = {
  code: string;
  name: string;
  population2022: number;
  population2025: number;
  gdpPerCapita: number;
  areaKm2: number;
  idhm: number;
  /** renda média mensal (Censo 2022 medido ou estimada pelo modelo PIB+IDHM) */
  avgIncome: number;
  medianIncome: number;
  incomeSource: string;
  /** CEMPRE/IBGE: salário médio mensal dos trabalhadores formais (em salários mínimos) */
  minWages2023?: number | null;
  /** CEMPRE/IBGE: salário médio mensal em reais (convertido pelo piso SP vigente) */
  formalSalary2023Brl?: number | null;
};

const EMBEDDED_IBGE = SP_IBGE_INDICATORS as SpIndicator[];

/**
 * CARREGAMENTO PREGUIÇOSO DE INDICADORES IBGE — Land Bank Corp
 * ------------------------------------------------------------------
 * Cada município é enriquecido UMA vez, no momento em que é selecionado no
 * cadastro (ou importado via KMZ), e o resultado é GRAVADO em `ibge_cities`.
 * Consultas seguintes leem apenas o banco — mantendo o CRM leve.
 *
 * Fluxo:
 * 1) já possui população → retorna do banco (status "cached");
 * 2) usa a base oficial embarcada do IBGE (Censo 2022, PIB 2023, área e IDHM 2010)
 *    para TODOS os 645 municípios de SP — carregamento instantâneo e sem rede;
 * 3) se o município não estiver na base, tenta a API oficial do IBGE;
 * 4) registra `ibgeCheckedAt` e grava tudo em `ibge_cities` (cache permanente).
 */

export const REGIONAL_MODEL = {
  medianIncome: 1920,
  meanIncome: 2032,
  /** @deprecated razão linear não é usada — ver src/lib/income-model.ts */
  medianIdhm: 0.769,
  medianUrbanization: 95.6,
  medianMarketM2: 325,
  sampleSize: 33,
};

const CACHE_HOURS = 6;

type IbgeSeries = {
  resultados?: {
    series?: {
      localidade?: { id: string; nome: string };
      serie?: Record<string, string>;
    }[];
  }[];
};

async function fetchJson<T>(url: string, timeoutMs = 7000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "LandBankCorpCRM/1.3 (junior.lopes@creci.org.br)" },
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function readSeries(payload: IbgeSeries | null, period: string): number | null {
  const raw = payload?.resultados?.[0]?.series?.[0]?.serie?.[period];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export type IbgeFetch = {
  population2022: number | null;
  population2010: number | null;
  gdpPerCapita: number | null;
  live: boolean;
  endpoints: string[];
};

/** Consulta oficial do IBGE com timeouts curtos e falha silenciosa. */
export async function fetchIbgeIndicators(ibgeCode: string): Promise<IbgeFetch> {
  const endpoints: string[] = [];
  const base = "https://servicodados.ibge.gov.br/api/v3/agregados";
  const code = `N6[${ibgeCode}]`;

  const pop2022Payload = await fetchJson<IbgeSeries[]>(
    `${base}/4714/periodos/2022/variaveis/93?localidades=${encodeURIComponent(code)}`,
  );
  endpoints.push("agregado 4714 (população 2022)");
  const population2022 = readSeries(pop2022Payload?.[0] ?? null, "2022");

  const pop2010Payload = await fetchJson<IbgeSeries[]>(
    `${base}/202/periodos/2010/variaveis/93?localidades=${encodeURIComponent(code)}`,
  );
  endpoints.push("agregado 202 (população 2010)");
  const population2010 = readSeries(pop2010Payload?.[0] ?? null, "2010");

  const gdpPayload = await fetchJson<IbgeSeries[]>(
    `${base}/5938/periodos/2021/variaveis/37?localidades=${encodeURIComponent(code)}`,
  );
  endpoints.push("agregado 5938 (PIB per capita 2021)");
  const gdpPerCapita = readSeries(gdpPayload?.[0] ?? null, "2021");

  return {
    population2022,
    population2010: population2010 ?? (population2022 ? Math.round(population2022 / 1.15) : null),
    gdpPerCapita,
    live: Boolean(population2022 || population2010 || gdpPerCapita),
    endpoints,
  };
}

export type EnrichStatus = "cached" | "loaded" | "estimated" | "unavailable";

export type EnrichResult = {
  status: EnrichStatus;
  city: City;
  source: string;
  message: string;
  ibgeLive: boolean;
  checkedAt: string;
};

function localMunicipality(name?: string, ibgeCode?: string) {
  const list = SP_MUNICIPALITIES as { code: string; name: string; lat: number; lng: number }[];
  if (ibgeCode) {
    const byCode = list.find((item) => item.code === ibgeCode);
    if (byCode) return byCode;
  }
  if (name) {
    const target = slugifyCity(name);
    return list.find((item) => slugifyCity(item.name) === target);
  }
  return undefined;
}

type EnrichInput = { slug?: string; name?: string; ibgeCode?: string; lat?: number; lng?: number };

export async function enrichCity(input: EnrichInput): Promise<EnrichResult> {
  await ensureDatabase();
  const local = localMunicipality(input.name, input.ibgeCode);
  const embeddedMatch =
    EMBEDDED_IBGE.find((item) => input.ibgeCode && item.code === input.ibgeCode) ??
    EMBEDDED_IBGE.find((item) => slugifyCity(item.name) === slugifyCity(input.name ?? input.slug ?? ""));
  const slug = input.slug
    ? slugifyCity(input.slug)
    : local
      ? slugifyCity(local.name)
      : embeddedMatch
        ? slugifyCity(embeddedMatch.name)
        : slugifyCity(input.name ?? "");
  const name = embeddedMatch?.name ?? local?.name ?? input.name ?? input.slug ?? "";
  const ibgeCode = input.ibgeCode ?? embeddedMatch?.code ?? local?.code ?? "";
  const lat = input.lat ?? local?.lat ?? 0;
  const lng = input.lng ?? local?.lng ?? 0;

  const [existing] = await db.select().from(cities).where(eq(cities.slug, slug)).limit(1);
  const checkedAtIso = existing?.ibgeCheckedAt ? new Date(existing.ibgeCheckedAt).toISOString() : "";

  if (existing && existing.population2022 > 0 && existing.avgIncome > 0) {
    return {
      status: "cached",
      city: existing,
      source: existing.source,
      message: `Indicadores de ${existing.name} já estavam gravados no CRM.`,
      ibgeLive: existing.source.includes("IBGE"),
      checkedAt: checkedAtIso,
    };
  }

  // respeita a janela de cache para não sobrecarregar a API do IBGE
  const recentlyChecked =
    existing?.ibgeCheckedAt &&
    Date.now() - new Date(existing.ibgeCheckedAt).getTime() < CACHE_HOURS * 60 * 60 * 1000;

  const curated = CITY_SEED.find((seed) => slugifyCity(seed.name) === slug);
  const embedded =
    EMBEDDED_IBGE.find((item) => item.code === ibgeCode) ??
    EMBEDDED_IBGE.find((item) => slugifyCity(item.name) === slug);
  let ibge: IbgeFetch = {
    population2022: null,
    population2010: null,
    gdpPerCapita: null,
    live: false,
    endpoints: [],
  };
  // base embarcada cobre o Estado de SP: só consulta a rede quando o município não está nela
  if (!recentlyChecked && !curated && !embedded && ibgeCode) {
    ibge = await fetchIbgeIndicators(ibgeCode);
  }

  const population2022 =
    curated?.population2022 ?? embedded?.population2022 ?? ibge.population2022 ?? existing?.population2022 ?? 0;
  const population2010 =
    curated?.population2010 ??
    (embedded && embedded.population2022 > 0 ? Math.round(embedded.population2022 / 1.12) : null) ??
    ibge.population2010 ??
    existing?.population2010 ??
    0;
  const gdpPerCapita =
    curated?.gdpPerCapita ?? embedded?.gdpPerCapita ?? ibge.gdpPerCapita ?? existing?.gdpPerCapita ?? 0;

  /**
   * Renda média: prioriza o valor MEDIDO do Censo 2022 (municípios curados) e,
   * na ausência dele, usa o modelo auditado PIB + IDHM. Nunca usa razão linear
   * fixa — isso inflava a renda de municípios industriais (ex.: Itupeva).
   */
  const embeddedIncome = embedded?.avgIncome && embedded.avgIncome > 0 ? embedded.avgIncome : 0;
  const derivedIncome =
    !curated && gdpPerCapita > 0 ? estimateAvgIncome(gdpPerCapita, embedded?.idhm ?? existing?.idhm ?? 0.75) : 0;
  const avgIncome = curated
    ? curated.avgIncome
    : MEASURED_INCOME[slugifyCity(embedded?.name ?? name)] && embeddedIncome > 0
      ? MEASURED_INCOME[slugifyCity(embedded?.name ?? name)]
      : embeddedIncome > 0
        ? embeddedIncome
        : derivedIncome > 0
          ? derivedIncome
          : existing?.avgIncome && existing.avgIncome > 0
            ? existing.avgIncome
            : 0;

  const hasPopulation = population2022 > 0;
  const hasIncome = avgIncome > 0;
  if (!hasPopulation || !hasIncome) {
    if (!existing) {
      await db
        .insert(cities)
        .values({
          slug,
          name: name || input.slug || slug,
          ibgeCode,
          region: "São Paulo · base IBGE",
          lat,
          lng,
          population2022: population2022 ?? 0,
          population2010: population2010 ?? 0,
          gdpPerCapita: gdpPerCapita ?? 0,
          avgIncome,
          medianIncome: 0,
          consumptionPotential: 0,
          source: "IBGE — Localidades (indicadores pendentes)",
          ibgeCheckedAt: new Date(),
        })
        .onConflictDoNothing();
    } else {
      await db.update(cities).set({ ibgeCheckedAt: new Date() }).where(eq(cities.slug, slug));
    }
    const [row] = await db.select().from(cities).where(eq(cities.slug, slug)).limit(1);
    return {
      status: "unavailable",
      city: row ?? existing!,
      source: "IBGE indisponível no momento",
      message: `Não foi possível carregar os indicadores de ${name} agora. O município continua disponível para cadastro; os indicadores serão carregados na próxima tentativa (cache de ${CACHE_HOURS} h).`,
      ibgeLive: false,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * Salário médio dos trabalhadores FORMAIS — dado oficial do IBGE (CEMPRE 2023)
   * expresso em salários mínimos e convertido pelo piso paulista vigente.
   * Este é o indicador comparável ao portal do IBGE (ex.: Sumaré 3,3019).
   */
  const formalMinWages = embedded?.minWages2023 && embedded.minWages2023 > 0 ? embedded.minWages2023 : 0;
  const formalAvgSalary = formalMinWages > 0 ? wagesToBrl(formalMinWages) : 0;
  const medianIncome =
    curated?.medianIncome ??
    (embedded?.medianIncome && embedded.medianIncome > 0 ? embedded.medianIncome : estimateMedianIncome(avgIncome));
  const consumptionPotential = population2022 * avgIncome * 12;
  const estimated = !curated && !embedded && !ibge.population2022 && !ibge.gdpPerCapita;
  const source = curated
    ? "IBGE — Censo 2022 / Censo 2010 / IBGE Cidades / PNUD"
    : embedded
      ? `IBGE — Censo 2022 / PIB 2023 / IDHM 2010 · renda ${embedded.incomeSource ?? "estimada (PIB + IDHM)"}`
      : ibge.live
        ? "IBGE — Censo 2022 / Censo 2010 / PIB municipal (sincronizado)"
        : "Estimativa regional Land Bank Corp (IBGE indisponível)";

  const values = {
    name: name || existing?.name || slug,
    ibgeCode,
    region: existing?.region && existing.region !== "São Paulo · base IBGE" ? existing.region : "São Paulo · PIB e população IBGE",
    lat: lat || existing?.lat || 0,
    lng: lng || existing?.lng || 0,
    population2022,
    population2010,
    areaKm2: curated?.areaKm2 ?? embedded?.areaKm2 ?? existing?.areaKm2 ?? 0,
    gdpPerCapita,
    avgIncome,
    medianIncome,
    formalMinWages,
    formalAvgSalary,
    consumptionPotential,
    idhm: curated?.idhm ?? embedded?.idhm ?? existing?.idhm ?? REGIONAL_MODEL.medianIdhm,
    urbanization: curated?.urbanization ?? existing?.urbanization ?? REGIONAL_MODEL.medianUrbanization,
    marketPriceM2: curated?.marketPriceM2 ?? existing?.marketPriceM2 ?? REGIONAL_MODEL.medianMarketM2,
    topSectors: curated?.topSectors ?? existing?.topSectors ?? "Base econômica em detalhamento pelo time de inteligência.",
    highlights: curated?.highlights ?? existing?.highlights ?? [],
    source,
    ibgeCheckedAt: new Date(),
  };

  const [saved] = existing
    ? await db.update(cities).set(values).where(eq(cities.slug, slug)).returning()
    : await db.insert(cities).values({ slug, ...values }).returning();

  return {
    status: estimated ? "estimated" : "loaded",
    city: saved,
    source,
    message: estimated
      ? `Indicadores de ${saved.name} gravados como estimativa regional (sem base IBGE para este município).`
      : `Indicadores de ${saved.name} carregados e gravados: ${saved.population2022.toLocaleString("pt-BR")} hab (Censo 2022) · renda média ${saved.avgIncome.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} · potencial de consumo ${saved.consumptionPotential.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}/ano.`,
    ibgeLive: ibge.live,
    checkedAt: new Date().toISOString(),
  };
}
