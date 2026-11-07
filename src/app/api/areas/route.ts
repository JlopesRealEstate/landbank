import { requireEditor } from "@/lib/authorization";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, areas, cities } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { getAreas } from "@/lib/data";
import { parseAreaInput } from "@/lib/validation";
import { findCity } from "@/lib/cities";
import { enrichCity } from "@/lib/ibge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await getAreas();
    return Response.json({ ok: true, areas: list });
  } catch (error) {
    console.error("[areas:GET]", error);
    return Response.json({ ok: false, error: "Não foi possível carregar as áreas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireEditor();
  if ("response" in access) return access.response;
  try {
    await ensureDatabase();
    const body = await request.json().catch(() => null);
    const { value, errors } = parseAreaInput(body);
    if (errors.length) {
      return Response.json({ ok: false, errors }, { status: 400 });
    }

    let code = value.code;
    const existing = await db.select({ id: areas.id }).from(areas).where(eq(areas.code, code)).limit(1);
    if (existing.length) {
      code = `${code}-${Math.floor(10 + Math.random() * 89)}`;
    }

    const citySeed = findCity(value.city);
    const [cityRow] = await db.select().from(cities).where(eq(cities.slug, value.citySlug)).limit(1);
    if (!cityRow && citySeed) {
      await db.insert(cities).values({ ...citySeed }).onConflictDoNothing();
    }
    // carrega e grava os indicadores do município no momento do cadastro (uma única vez)
    if (!cityRow || cityRow.population2022 === 0) {
      await enrichCity({ slug: value.citySlug, name: value.city, lat: value.lat, lng: value.lng }).catch(() => undefined);
    }

    const [created] = await db
      .insert(areas)
      .values({ ...value, code })
      .returning();

    await db.insert(activities).values({
      areaId: created.id,
      type: "created",
      title: "Ativo cadastrado",
      detail: `${created.code} · ${created.city}${citySeed ? ` · indicadores IBGE vinculados (${citySeed.population2022} hab)` : ""}`,
    });

    return Response.json({ ok: true, area: created }, { status: 201 });
  } catch (error) {
    console.error("[areas:POST]", error);
    return Response.json({ ok: false, error: "Não foi possível salvar o imóvel." }, { status: 500 });
  }
}
