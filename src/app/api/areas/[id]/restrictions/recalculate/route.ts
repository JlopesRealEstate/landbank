import { eq } from "drizzle-orm";
import { db } from "@/db";
import { areaRestrictions, areas } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { intersectionWithKmz } from "@/lib/clip";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Reprocessa todas as demarcações de perda do imóvel aplicando a regra atual:
 * conta apenas a área DENTRO da demarcação do KMZ.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const areaId = Number(id);
    if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const [area] = await db
      .select({ id: areas.id, geometry: areas.geometry, code: areas.code })
      .from(areas)
      .where(eq(areas.id, areaId))
      .limit(1);
    if (!area) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const kmzRings = (area.geometry ?? []).map((ring) => ring.coordinates);
    const rows = await db.select().from(areaRestrictions).where(eq(areaRestrictions.areaId, areaId));

    let updated = 0;
    const result = [];
    for (const row of rows) {
      const loss = intersectionWithKmz(row.coordinates, kmzRings);
      const [saved] = await db
        .update(areaRestrictions)
        .set({
          areaM2: loss.insideM2,
          grossAreaM2: loss.grossM2,
          outsideAreaM2: loss.outsideM2,
          lossPct: loss.lossPct,
        })
        .where(eq(areaRestrictions.id, row.id))
        .returning();
      updated += 1;
      result.push(saved);
    }

    return Response.json({ ok: true, updated, restrictions: result });
  } catch (error) {
    console.error("[restrictions:recalculate]", error);
    return Response.json({ ok: false, error: "Não foi possível recalcular as perdas." }, { status: 500 });
  }
}
