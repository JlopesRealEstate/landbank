import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { getAreaForMedia, logActivity } from "@/lib/data";
import { MAX_UPLOAD_BYTES, isAllowedMime, safeFileName } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const DOC_MIME_FALLBACK = "application/octet-stream";

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const areaId = Number(id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  await ensureDatabase();
  const rows = await db
    .select({
      id: media.id,
      areaId: media.areaId,
      kind: media.kind,
      category: media.category,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      caption: media.caption,
      externalUrl: media.externalUrl,
      sortOrder: media.sortOrder,
      createdAt: media.createdAt,
    })
    .from(media)
    .where(eq(media.areaId, areaId))
    .orderBy(asc(media.sortOrder), asc(media.id));

  return Response.json({
    ok: true,
    media: rows.map((row) => ({ ...row, url: row.externalUrl ?? `/api/media/${row.id}` })),
  });
}

export async function POST(request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const areaId = Number(id);
    if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
    const area = await getAreaForMedia(areaId);
    if (!area) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const payload = (await request.json().catch(() => null)) as
      | { items?: unknown[]; kind?: string; category?: string; name?: string; mimeType?: string; data?: string; caption?: string }
      | null;

    if (!payload) return Response.json({ ok: false, error: "Payload inválido." }, { status: 400 });

    const rawItems = Array.isArray(payload.items) ? payload.items : [payload];
    const inserted: number[] = [];

    for (const raw of rawItems) {
      const item = raw as Record<string, unknown>;
      const kind = item.kind === "document" ? "document" : "photo";
      const mimeType = typeof item.mimeType === "string" && item.mimeType ? item.mimeType : DOC_MIME_FALLBACK;
      const base64 = typeof item.data === "string" ? item.data.replace(/^data:[^;]+;base64,/, "") : "";
      if (!base64) continue;
      if (!isAllowedMime(mimeType)) {
        return Response.json({ ok: false, error: `Formato não permitido (${mimeType}).` }, { status: 415 });
      }
      const size = Math.floor((base64.length * 3) / 4);
      if (size > MAX_UPLOAD_BYTES) {
        return Response.json({ ok: false, error: "Arquivo acima de 9 MB. Reduza o arquivo e tente novamente." }, { status: 413 });
      }
      const [row] = await db
        .insert(media)
        .values({
          areaId,
          kind,
          category: typeof item.category === "string" && item.category ? item.category : kind === "photo" ? "fachada" : "Outro",
          name: safeFileName(typeof item.name === "string" && item.name ? item.name : "arquivo"),
          mimeType,
          size,
          caption: typeof item.caption === "string" ? item.caption.slice(0, 240) : "",
          data: base64,
          sortOrder: 50 + inserted.length,
        })
        .returning({ id: media.id });
      if (row) inserted.push(row.id);
    }

    if (!inserted.length) {
      return Response.json({ ok: false, error: "Nenhum arquivo válido recebido." }, { status: 400 });
    }

    await logActivity(areaId, "upload", "Novos arquivos anexados", `${inserted.length} arquivo(s) adicionados ao dossiê de ${area.code}.`);
    return Response.json({ ok: true, ids: inserted }, { status: 201 });
  } catch (error) {
    console.error("[areas:id:media:POST]", error);
    return Response.json({ ok: false, error: "Não foi possível enviar os arquivos." }, { status: 500 });
  }
}
