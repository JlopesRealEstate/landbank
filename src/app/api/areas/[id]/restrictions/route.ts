import { eq } from "drizzle-orm";
import { db } from "@/db";
import { areaRestrictions, areas } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { logActivity } from "@/lib/data";
import { corridorFromAxis, LINHAO_TYPE, templateById } from "@/lib/linhao";
import { intersectionWithKmz } from "@/lib/clip";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const TYPES = new Set(["app", "nascente", "linhao", "duto", "faixa_estrada", "reserva_legal", "alagado", "outro"]);

/**
 * Linhão: o usuário informa o EIXO (traço) e o recuo padrão; o polígono da faixa
 * de servidão é calculado a partir do eixo (CPFL GED-22 / NBR 5422).
 * Demais tipos mantêm a demarcação por vértices (polígono).
 */
function resolveGeometry(input: {
  type: string;
  coordinates?: [number, number][];
  axis?: [number, number][];
  setbackM?: number;
  templateId?: string;
}) {
  if (input.type === LINHAO_TYPE) {
    const template = templateById(input.templateId ?? "at-69-88-138");
    const setbackM = Math.min(
      200,
      Math.max(1, Number(input.setbackM) || template.setbackM || 15),
    );
    const axis = Array.isArray(input.axis)
      ? input.axis
          .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2)
          .map(([lng, lat]) => [Number(lng), Number(lat)] as [number, number])
      : [];
    if (axis.length < 2) {
      return { error: "Trace pelo menos 2 pontos do eixo do linhão no mapa." as string };
    }
    const corridor = corridorFromAxis(axis, setbackM);
    if (corridor.polygon.length < 4 || corridor.areaM2 <= 0) {
      return { error: "Não foi possível gerar a faixa de servidão a partir do eixo." as string };
    }
    return {
      coordinates: corridor.polygon,
      geometryType: "axis",
      axisMeta: {
        axis,
        setbackM,
        widthM: corridor.widthM,
        lengthM: corridor.lengthM,
        voltageKv: template.voltageKv,
        standard: template.label,
        source: template.source,
      },
    };
  }

  const coordinates = Array.isArray(input.coordinates)
    ? input.coordinates
        .filter((point): point is [number, number] => Array.isArray(point) && point.length >= 2)
        .map(([lng, lat]) => [Number(lng), Number(lat)] as [number, number])
    : [];
  if (coordinates.length < 3) {
    return { error: "Demarque pelo menos 3 pontos no mapa." as string };
  }
  const closed =
    coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
    coordinates[0][1] === coordinates[coordinates.length - 1][1]
      ? coordinates
      : [...coordinates, coordinates[0]];
  return { coordinates: closed, geometryType: "polygon", axisMeta: null };
}

export async function GET(_request: Request, { params }: Params) {
  await ensureDatabase();
  const { id } = await params;
  const areaId = Number(id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  const rows = await db.select().from(areaRestrictions).where(eq(areaRestrictions.areaId, areaId));
  return Response.json({ ok: true, restrictions: rows });
}

export async function POST(request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const areaId = Number(id);
    if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const [area] = await db
      .select({ id: areas.id, landAreaM2: areas.landAreaM2, code: areas.code, geometry: areas.geometry })
      .from(areas)
      .where(eq(areas.id, areaId))
      .limit(1);
    if (!area) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      label?: string;
      notes?: string;
      coordinates?: [number, number][];
      axis?: [number, number][];
      setbackM?: number;
      templateId?: string;
    };

    const type = TYPES.has(String(body.type)) ? String(body.type) : "app";
    const geometry = resolveGeometry({
      type,
      coordinates: body.coordinates,
      axis: body.axis,
      setbackM: body.setbackM,
      templateId: body.templateId,
    });
    if ("error" in geometry) {
      return Response.json({ ok: false, error: geometry.error }, { status: 400 });
    }
    const closed = geometry.coordinates;
    // PERDA = somente a parcela DENTRO da demarcação do KMZ (fora é desconsiderada)
    const kmzRings = (area.geometry ?? []).map((ring) => ring.coordinates);
    const loss = intersectionWithKmz(closed, kmzRings);
    const areaM2 = loss.insideM2;
    if (areaM2 <= 0) {
      return Response.json(
        { ok: false, error: "A demarcação ficou fora do perímetro do KMZ — nenhuma perda a considerar." },
        { status: 400 },
      );
    }
    const lossPct = loss.lossPct;

    const [created] = await db
      .insert(areaRestrictions)
      .values({
        areaId,
        type,
        geometryType: geometry.geometryType,
        axisMeta: geometry.axisMeta,
        label: (body.label ?? "").slice(0, 120),
        notes: (body.notes ?? "").slice(0, 400),
        coordinates: closed,
        areaM2,
        grossAreaM2: loss.grossM2,
        outsideAreaM2: loss.outsideM2,
        lossPct,
      })
      .returning();

    await logActivity(
      areaId,
      "restriction",
      "Restrição demarcada",
      `${type}${geometry.geometryType === "axis" ? ` (eixo, recuo ${geometry.axisMeta?.setbackM} m/lado)` : ""} · ${areaM2.toLocaleString("pt-BR")} m² dentro do KMZ (${lossPct.toFixed(2)}% da demarcação)${loss.outsideM2 > 0 ? ` · ${loss.outsideM2.toLocaleString("pt-BR")} m² fora desconsiderados` : ""} em ${area.code}`,
    );

    return Response.json({ ok: true, restriction: created }, { status: 201 });
  } catch (error) {
    console.error("[restrictions:POST]", error);
    return Response.json({ ok: false, error: "Não foi possível salvar a restrição." }, { status: 500 });
  }
}

/** Atualiza uma demarcação existente (reabrir no mapa e ajustar os vértices). */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const areaId = Number(id);
    if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as {
      id?: number;
      type?: string;
      label?: string;
      notes?: string;
      coordinates?: [number, number][];
      axis?: [number, number][];
      setbackM?: number;
      templateId?: string;
    };
    const restrictionId = Number(body.id);
    if (!Number.isInteger(restrictionId)) {
      return Response.json({ ok: false, error: "Informe a restrição a atualizar." }, { status: 400 });
    }

    const [area] = await db
      .select({ id: areas.id, landAreaM2: areas.landAreaM2, code: areas.code, geometry: areas.geometry })
      .from(areas)
      .where(eq(areas.id, areaId))
      .limit(1);
    if (!area) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const [existing] = await db
      .select()
      .from(areaRestrictions)
      .where(eq(areaRestrictions.id, restrictionId))
      .limit(1);
    if (!existing || existing.areaId !== areaId) {
      return Response.json({ ok: false, error: "Restrição não encontrada." }, { status: 404 });
    }

    const nextType = TYPES.has(String(body.type)) ? String(body.type) : existing.type;
    const geometry = resolveGeometry({
      type: nextType,
      coordinates: Array.isArray(body.coordinates) ? body.coordinates : existing.coordinates,
      axis: Array.isArray(body.axis) ? body.axis : existing.axisMeta?.axis,
      setbackM: body.setbackM ?? existing.axisMeta?.setbackM,
      templateId: body.templateId,
    });
    if ("error" in geometry) {
      return Response.json({ ok: false, error: geometry.error }, { status: 400 });
    }
    const closed = geometry.coordinates;
    // PERDA = somente a parcela DENTRO da demarcação do KMZ (fora é desconsiderada)
    const kmzRings = (area.geometry ?? []).map((ring) => ring.coordinates);
    const loss = intersectionWithKmz(closed, kmzRings);
    const areaM2 = loss.insideM2;
    if (areaM2 <= 0) {
      return Response.json(
        { ok: false, error: "A demarcação ficou fora do perímetro do KMZ — nenhuma perda a considerar." },
        { status: 400 },
      );
    }
    const lossPct = loss.lossPct;

    const [updated] = await db
      .update(areaRestrictions)
      .set({
        type: nextType,
        geometryType: geometry.geometryType,
        axisMeta: geometry.axisMeta,
        label: body.label !== undefined ? String(body.label).slice(0, 120) : existing.label,
        notes: body.notes !== undefined ? String(body.notes).slice(0, 400) : existing.notes,
        coordinates: closed,
        areaM2,
        grossAreaM2: loss.grossM2,
        outsideAreaM2: loss.outsideM2,
        lossPct,
      })
      .where(eq(areaRestrictions.id, restrictionId))
      .returning();

    await logActivity(
      areaId,
      "restriction",
      "Restrição atualizada",
      `${updated.type} · ${areaM2.toLocaleString("pt-BR")} m² dentro do KMZ (${lossPct.toFixed(2)}% da demarcação)${loss.outsideM2 > 0 ? ` · ${loss.outsideM2.toLocaleString("pt-BR")} m² fora desconsiderados` : ""} em ${area.code}`,
    );

    return Response.json({ ok: true, restriction: updated });
  } catch (error) {
    console.error("[restrictions:PATCH]", error);
    return Response.json({ ok: false, error: "Não foi possível atualizar a restrição." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  await ensureDatabase();
  const { id } = await params;
  const areaId = Number(id);
  const restrictionId = Number(new URL(request.url).searchParams.get("restrictionId"));
  if (!Number.isInteger(areaId) || !Number.isInteger(restrictionId)) {
    return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }
  await db.delete(areaRestrictions).where(eq(areaRestrictions.id, restrictionId));
  return Response.json({ ok: true });
}
