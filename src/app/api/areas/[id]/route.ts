import { requireAdmin } from "@/lib/authorization";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { getAreaById, logActivity } from "@/lib/data";
import { parseAreaInput } from "@/lib/validation";
import { enrichCity } from "@/lib/ibge";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }
  const result = await getAreaById(numericId);
  if (!result) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });
  return Response.json({ ok: true, ...result });
}

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  try {
    await ensureDatabase();
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
      return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
    }
    const [existing] = await db.select().from(areas).where(eq(areas.id, numericId)).limit(1);
    if (!existing) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return Response.json({ ok: false, error: "Payload inválido." }, { status: 400 });

    const merged = { ...existing, ...body, code: existing.code };
    const { value, errors } = parseAreaInput(merged);
    if (errors.length) return Response.json({ ok: false, errors }, { status: 400 });

    const [updated] = await db
      .update(areas)
      .set({ ...value, code: existing.code, updatedAt: new Date() })
      .where(eq(areas.id, numericId))
      .returning();

    if (updated.citySlug !== existing.citySlug) {
      await enrichCity({ slug: updated.citySlug, name: updated.city, lat: updated.lat, lng: updated.lng }).catch(
        () => undefined,
      );
    }

    await logActivity(numericId, "updated", "Cadastro atualizado", `Dados de ${updated.code} revisados.`);
    return Response.json({ ok: true, area: updated });
  } catch (error) {
    console.error("[areas:id:PATCH]", error);
    return Response.json({ ok: false, error: "Não foi possível atualizar o imóvel." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  try {
    await ensureDatabase();
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
      return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
    }
    const deleted = await db.delete(areas).where(eq(areas.id, numericId)).returning({ id: areas.id });
    if (!deleted.length) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[areas:id:DELETE]", error);
    return Response.json({ ok: false, error: "Não foi possível excluir o imóvel." }, { status: 500 });
  }
}
