import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cities } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type IbgeAggregate = {
  resultados?: {
    series?: {
      localidade?: { id: string; nome: string };
      serie?: Record<string, string>;
    }[];
  }[];
};

/**
 * Sincroniza população dos municípios de São Paulo direto do IBGE (Censo 2022).
 * A base já inclui os 645 municípios de SP com código IBGE e coordenadas; este endpoint
 * enriquece população quando a API do IBGE está acessível pela rede do servidor.
 */
export async function POST() {
  try {
    await ensureDatabase();
    const url =
      "https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=N6[N3[35]]";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timeout);

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error: "API do IBGE indisponível neste ambiente.",
          hint: "A base de 645 municípios de SP já está carregada com código IBGE e coordenadas. Tente novamente quando a rede permitir acesso a servicodados.ibge.gov.br.",
        },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as IbgeAggregate[];
    const series = payload[0]?.resultados?.[0]?.series ?? [];
    let updated = 0;

    for (const item of series) {
      const ibgeCode = item.localidade?.id;
      const raw = item.serie?.["2022"];
      const population = Number(raw);
      if (!ibgeCode || !Number.isFinite(population)) continue;
      const result = await db
        .update(cities)
        .set({ population2022: Math.round(population), source: "IBGE — Censo 2022 (sincronizado)" })
        .where(eq(cities.ibgeCode, ibgeCode))
        .returning({ id: cities.id });
      updated += result.length;
    }

    const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(cities);
    return Response.json({ ok: true, updated, cities: total?.count ?? 0 });
  } catch (error) {
    console.error("[ibge:sync]", error);
    return Response.json({ ok: false, error: "Falha ao sincronizar com o IBGE." }, { status: 500 });
  }
}

export async function GET() {
  await ensureDatabase();
  const rows = await db.select({ name: cities.name, ibgeCode: cities.ibgeCode, population2022: cities.population2022 }).from(cities);
  return Response.json({
    ok: true,
    total: rows.length,
    withPopulation: rows.filter((row) => row.population2022 > 0).length,
    source: "IBGE — Localidades (645 municípios de SP) + Censo 2022",
  });
}
