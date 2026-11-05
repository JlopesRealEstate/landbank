import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { getMediaFile } from "@/lib/data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId)) return new Response("ID inválido", { status: 400 });

  const row = await getMediaFile(mediaId);
  if (!row) return new Response("Arquivo não encontrado", { status: 404 });

  if (!row.data && row.externalUrl) {
    if (/^https?:/i.test(row.externalUrl)) {
      return Response.redirect(row.externalUrl, 302);
    }
    return new Response(null, { status: 302, headers: { Location: row.externalUrl } });
  }

  if (!row.data) return new Response("Arquivo indisponível", { status: 404 });

  const buffer = Buffer.from(row.data, "base64");
  const download = new URL(request.url).searchParams.get("download") === "1";
  const bytes = new Uint8Array(buffer);

  return new Response(bytes, {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(row.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const mediaId = Number(id);
    if (!Number.isInteger(mediaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
    const deleted = await db.delete(media).where(eq(media.id, mediaId)).returning({ id: media.id });
    if (!deleted.length) return Response.json({ ok: false, error: "Arquivo não encontrado." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[media:DELETE]", error);
    return Response.json({ ok: false, error: "Não foi possível remover o arquivo." }, { status: 500 });
  }
}
