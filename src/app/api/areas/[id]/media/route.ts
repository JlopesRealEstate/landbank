import { createClient } from "@/lib/supabase/server";
import { MAX_UPLOAD_BYTES, isAllowedMime, safeFileName } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const BUCKET = "landbank-files";
const FALLBACK_MIME = "application/octet-stream";

export async function GET(_request: Request, { params }: Params) {
  const areaId = Number((await params).id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  try {
    const supabase = await createClient() as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    const { data, error } = await supabase.from("media").select("id,area_id,kind,category,name,mime_type,size,caption,external_url,sort_order,created_at").eq("area_id", areaId).order("sort_order").order("id");
    if (error) throw error;
    return Response.json({ ok: true, media: (data ?? []).map((row: { id: number; area_id: number; kind: string; category: string; name: string; mime_type: string; size: number; caption: string; external_url: string | null; sort_order: number; created_at: string }) => ({
      id: row.id, areaId: row.area_id, kind: row.kind, category: row.category, name: row.name,
      mimeType: row.mime_type, size: row.size, caption: row.caption, externalUrl: row.external_url,
      sortOrder: row.sort_order, createdAt: row.created_at, url: row.external_url ?? `/api/media/${row.id}`,
    })) });
  } catch (error) {
    console.error("[areas:id:media:GET]", error);
    return Response.json({ ok: false, error: "Não foi possível carregar os arquivos." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const areaId = Number((await params).id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  try {
    const supabase = await createClient() as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ ok: false, error: "Não autenticado." }, { status: 401 });

    const { data: area, error: areaError } = await supabase.from("areas").select("id,code").eq("id", areaId).maybeSingle();
    if (areaError) throw areaError;
    if (!area) return Response.json({ ok: false, error: "Imóvel não encontrado no Supabase." }, { status: 404 });

    const payload = await request.json().catch(() => null) as
      | { items?: unknown[]; kind?: string; category?: string; name?: string; mimeType?: string; data?: string; caption?: string }
      | null;
    if (!payload) return Response.json({ ok: false, error: "Payload inválido." }, { status: 400 });

    const items = Array.isArray(payload.items) ? payload.items : [payload];
    const inserted: number[] = [];
    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const kind = item.kind === "document" ? "document" : "photo";
      const mimeType = typeof item.mimeType === "string" && item.mimeType ? item.mimeType : FALLBACK_MIME;
      const base64 = typeof item.data === "string" ? item.data.replace(/^data:[^;]+;base64,/, "") : "";
      if (!base64) continue;
      if (!isAllowedMime(mimeType)) return Response.json({ ok: false, error: `Formato não permitido (${mimeType}).` }, { status: 415 });
      const bytes = Buffer.from(base64, "base64");
      if (bytes.byteLength > MAX_UPLOAD_BYTES) return Response.json({ ok: false, error: "Arquivo acima de 9 MB." }, { status: 413 });

      const name = safeFileName(typeof item.name === "string" && item.name ? item.name : "arquivo");
      const storagePath = `${areaId}/${crypto.randomUUID()}-${name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, new Uint8Array(bytes), {
        contentType: mimeType, upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: row, error: insertError } = await supabase.from("media").insert({
        area_id: areaId, kind, category: typeof item.category === "string" && item.category ? item.category : kind === "photo" ? "fachada" : "outro",
        name, mime_type: mimeType, size: bytes.byteLength,
        caption: typeof item.caption === "string" ? item.caption.slice(0, 240) : "",
        storage_path: storagePath, data: null, created_by: user.id, sort_order: 50 + inserted.length,
      }).select("id").single();
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw insertError;
      }
      inserted.push(row.id);
    }
    if (!inserted.length) return Response.json({ ok: false, error: "Nenhum arquivo válido recebido." }, { status: 400 });

    await supabase.from("activities").insert({
      area_id: areaId, type: "upload", title: "Novos arquivos anexados",
      detail: `${inserted.length} arquivo(s) adicionados ao dossiê de ${area.code}.`, actor_id: user.id,
    });
    return Response.json({ ok: true, ids: inserted }, { status: 201 });
  } catch (error) {
    console.error("[areas:id:media:POST]", error);
    return Response.json({ ok: false, error: "Não foi possível enviar os arquivos ao armazenamento seguro." }, { status: 500 });
  }
}
