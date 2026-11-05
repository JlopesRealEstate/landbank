import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { marketNews } from "@/db/schema";
import type { NewsItem } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";

/**
 * PAINEL DE NOTÍCIAS DO MERCADO CORPORATIVO
 * Atualização automática diária: coleta RSS de veículos de economia e imóveis
 * (InfoMoney, Exame, Money Times e Google News com termos de logística/galpões),
 * grava um snapshot por dia no banco e serve o snapshot mais recente.
 * Se as fontes estiverem inacessíveis, mantém o último snapshot gravado.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const FEEDS: { url: string; category: string; source: string }[] = [
  {
    url: "https://news.google.com/rss/search?q=galp%C3%B5es+log%C3%ADsticos+Brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    category: "Galpões & logística",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=mercado+imobili%C3%A1rio+corporativo+terrenos+industriais&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    category: "Áreas & terrenos",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=IBGE+economia+ind%C3%BAstria+juros+IPCA&hl=pt-BR&gl=BR&ceid=BR:pt-419",
    category: "Índices & economia",
    source: "Google News",
  },
  { url: "https://www.infomoney.com.br/feed/", category: "Mercado", source: "InfoMoney" },
  { url: "https://exame.com/feed/", category: "Negócios", source: "Exame" },
  { url: "https://www.moneytimes.com.br/feed/", category: "Mercado", source: "Money Times" },
];

const FALLBACK_ITEMS: NewsItem[] = [
  {
    title: "Mercado de galpões logísticos mantém demanda aquecida no interior paulista",
    link: "https://www.abralog.org.br/",
    source: "ABRALOG",
    publishedAt: new Date().toISOString(),
    summary:
      "Eixo Anhanguera–Bandeirantes segue como principal corredor logístico do Estado, com procura por galpões classe A acima de 10 mil m².",
    category: "Galpões & logística",
  },
  {
    title: "Região Metropolitana de Campinas atrai novos centros de distribuição",
    link: "https://www.investe.sp.gov.br/",
    source: "Investe SP",
    publishedAt: new Date().toISOString(),
    summary:
      "Sumaré, Hortolândia, Nova Odessa e Monte Mor concentram expansão logística pela proximidade de Viracopos e das rodovias Anhanguera e Bandeirantes.",
    category: "Áreas & terrenos",
  },
  {
    title: "IBGE: atividade industrial e renda média orientam decisões de land bank",
    link: "https://www.ibge.gov.br/",
    source: "IBGE",
    publishedAt: new Date().toISOString(),
    summary:
      "Indicadores de população, PIB municipal e rendimento domiciliar são a base para calibrar benchmark de solo e potencial de consumo da região.",
    category: "Índices & economia",
  },
];

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRss(xml: string, category: string, fallbackSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const block of blocks.slice(0, 8)) {
    const rawTitle = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const rawLink = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const rawDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
    const rawDescription =
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ??
      block.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ??
      "";
    const sourceTag = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "";
    const title = decode(rawTitle);
    const link = decode(rawLink);
    if (!title || !link) continue;
    const published = rawDate ? new Date(rawDate) : new Date();
    items.push({
      title: title.slice(0, 180),
      link,
      source: decode(sourceTag) || fallbackSource,
      publishedAt: Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString(),
      summary: decode(rawDescription).slice(0, 220),
      category,
    });
  }
  return items;
}

async function fetchFeed(feed: { url: string; category: string; source: string }): Promise<NewsItem[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "LandBankCorpCRM/1.4 (junior.lopes@creci.org.br)", Accept: "application/rss+xml, application/xml" },
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    return parseRss(await response.text(), feed.category, feed.source);
  } catch {
    return [];
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Indicadores de mercado exibidos junto às notícias (referências internas + IBGE). */
export const MARKET_INDICES = [
  { label: "Benchmark solo RMC", value: "325–705", unit: "R$/m²", note: "faixa auditada por município" },
  { label: "Vacância galpões classe A", value: "8–12", unit: "%", note: "referência regional RMC" },
  { label: "Cap rate logístico", value: "7,5–9,0", unit: "% a.a.", note: "referência de mercado" },
  { label: "Custo terraplenagem", value: "24–130", unit: "R$/m²", note: "corte + aterro + transporte" },
];

export type NewsSnapshot = {
  day: string;
  items: NewsItem[];
  indices: { label: string; value: string; unit: string; note: string }[];
  source: string;
  fetchedAt: string;
  stale: boolean;
  live: boolean;
};

async function collect(): Promise<{ items: NewsItem[]; live: boolean }> {
  const results = await Promise.all(FEEDS.map((feed) => fetchFeed(feed)));
  const merged = results.flat();
  const seen = new Set<string>();
  const unique = merged.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 70);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // prioriza assuntos ligados a áreas, galpões, logística, crédito e indicadores
  const RELEVANT = /(galp|log[ií]stic|im[oó]ve[l|]|terren|industrial|ind[uú]stria|incorpora|locac|aluguel|FII|fundo imobili|cr[eé]dito|juros|IPCA|IBGE|PIB|varejo|e-commerce|condom[ií]nio|armaz[eé]m|infraestrutura|saneamento|safra|agroneg[oó]cio|constru[cç][aã]o)/i;
  const relevant = unique.filter((item) => RELEVANT.test(`${item.title} ${item.summary}`));
  const items = (relevant.length >= 6 ? relevant : unique).slice(0, 12);
  return { items: items.length ? items : FALLBACK_ITEMS, live: items.length > 0 };
}

/** Retorna o snapshot do dia; coleta e grava se ainda não existir (1 coleta/dia). */
export async function getMarketNews(force = false, budgetMs = 3500): Promise<NewsSnapshot> {
  await ensureDatabase();
  const day = today();
  const [row] = await db.select().from(marketNews).where(eq(marketNews.day, day)).limit(1);

  if (row && !force && row.items.length > 0) {
    return {
      day: row.day,
      items: row.items,
      indices: row.indices.length ? row.indices : MARKET_INDICES,
      source: row.source,
      fetchedAt: row.fetchedAt.toISOString(),
      stale: false,
      live: true,
    };
  }

  // nunca bloqueia a tela: se a coleta passar do orçamento, serve o último snapshot
  const collected = await Promise.race([
    collect(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs)),
  ]);
  if (!collected) {
    return getLatestNews();
  }
  const { items, live } = collected;
  const [saved] = await db
    .insert(marketNews)
    .values({ day, items, indices: MARKET_INDICES })
    .returning();

  return {
    day: saved?.day ?? day,
    items: saved?.items ?? items,
    indices: MARKET_INDICES,
    source: saved?.source ?? "Google News · InfoMoney · Exame · Money Times",
    fetchedAt: (saved?.fetchedAt ?? new Date()).toISOString(),
    stale: false,
    live,
  };
}

/** Último snapshot disponível (usado quando a coleta diária falha). */
export async function getLatestNews(): Promise<NewsSnapshot> {
  await ensureDatabase();
  const [row] = await db.select().from(marketNews).orderBy(desc(marketNews.day)).limit(1);
  const fresh = row && Date.now() - new Date(row.fetchedAt).getTime() < DAY_MS;
  if (row) {
    return {
      day: row.day,
      items: row.items.length ? row.items : FALLBACK_ITEMS,
      indices: row.indices.length ? row.indices : MARKET_INDICES,
      source: row.source,
      fetchedAt: row.fetchedAt.toISOString(),
      stale: !fresh,
      live: row.items.length > 0,
    };
  }
  return {
    day: today(),
    items: FALLBACK_ITEMS,
    indices: MARKET_INDICES,
    source: "Conteúdo curado Land Bank Corp",
    fetchedAt: new Date().toISOString(),
    stale: true,
    live: false,
  };
}
