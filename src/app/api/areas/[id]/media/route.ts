import { requireEditor } from "@/lib/authorization";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;
    if (authError || !userId) return Response.json({ ok: false, error: "Sessão não autenticada ou expirada. Entre novamente no CRM." }, { status: 401 });
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
  const access = await requireEditor();
  if ("response" in access) return access.response;
  const areaId = Number((await params).id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  try {
    const supabase = await createClient() as any;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;
    if (authError || !userId) return Response.json({ ok: false, error: "Sessão expirada. Entre novamente no CRM." }, { status: 401 });

    const { data: area, error: areaError } = await supabase.from("areas").select("id,code").eq("id", areaId).maybeSingle();
    if (areaError) throw areaError;
    if (!area) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const payload = await request.json().catch(() => null) as { items?: Array<{ kind?: string; category?: string; name?: string; mimeType?: string; size?: number; storagePath?: string; caption?: string }> } | null;
    if (!payload || !Array.isArray(payload.items) || !payload.items.length) return Response.json({ ok: false, error: "Nenhum arquivo informado." }, { status: 400 });

    const photoItems = payload.items.filter((item) => item.kind !== "document");
    if (photoItems.length > 0) {
      const { count, error: countError } = await supabase.from("media")
        .select("id", { count: "exact", head: true })
        .eq("area_id", areaId).eq("kind", "photo");
      if (countError) throw countError;
      if ((count ?? 0) + photoItems.length > 100) {
        return Response.json({ ok: false, error: `Limite de 100 fotos por imóvel. Já existem ${count ?? 0}; disponíveis: ${Math.max(0, 100 - (count ?? 0))}.` }, { status: 409 });
      }
    }

    const inserted: number[] = [];
    for (const item of payload.items) {
      const name = safeFileName(typeof item.name === "string" ? item.name : "arquivo");
      const mimeType = typeof item.mimeType === "string" ? item.mimeType : FALLBACK_MIME;
      const size = Number(item.size);
      const storagePath = typeof item.storagePath === "string" ? item.storagePath : "";
      if (!storagePath.startsWith(`${areaId}/`) || storagePath.includes("..")) return Response.json({ ok: false, error: "Caminho de armazenamento inválido." }, { status: 400 });
      if (!isAllowedMime(mimeType)) return Response.json({ ok: false, error: `Formato não permitido (${mimeType}).` }, { status: 415 });
      if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) return Response.json({ ok: false, error: "Arquivo acima do limite de 9 MB ou vazio." }, { status: 413 });

      const { data: row, error: insertError } = await supabase.from("media").insert({
        area_id: areaId,
        kind: item.kind === "document" ? "document" : "photo",
        category: typeof item.category === "string" && item.category ? item.category : "outro",
        name, mime_type: mimeType, size,
        caption: typeof item.caption === "string" ? item.caption.slice(0, 240) : "",
        storage_path: storagePath, data: null, created_by: userId, sort_order: 50 + inserted.length,
      }).select("id").single();
      if (insertError) throw insertError;
      inserted.push(row.id);
    }

    await supabase.from("activities").insert({
      area_id: areaId, type: "upload", title: "Novos arquivos anexados",
      detail: `${inserted.length} arquivo(s) adicionados ao dossiê de ${area.code}.`, actor_id: userId,
    });
    return Response.json({ ok: true, ids: inserted }, { status: 201 });
  } catch (error) {
    console.error("[areas:id:media:POST]", error);
    const detail = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: `Falha ao registrar arquivo: ${detail.slice(0, 220)}` }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const access = await requireEditor();
  if ("response" in access) return access.response;
  const areaId = Number((await params).id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  try {
    const payload = await request.json() as { mediaId?: number };
    const mediaId = Number(payload.mediaId);
    if (!Number.isInteger(mediaId) || mediaId <= 0) return Response.json({ ok: false, error: "Selecione uma foto válida." }, { status: 400 });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !secret) throw new Error("Configuração segura do Supabase indisponível.");
    const admin = createAdminClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: photo, error: photoError } = await admin.from("media")
      .select("id").eq("id", mediaId).eq("area_id", areaId).eq("kind", "photo").maybeSingle();
    if (photoError) throw photoError;
    if (!photo) return Response.json({ ok: false, error: "Foto não encontrada neste imóvel." }, { status: 404 });
    const { error: clearError } = await admin.from("media").update({ category: "fachada" })
      .eq("area_id", areaId).eq("kind", "photo").eq("category", "capa");
    if (clearError) throw clearError;
    const { error: setError } = await admin.from("media").update({ category: "capa", sort_order: 0 })
      .eq("id", mediaId).eq("area_id", areaId);
    if (setError) throw setError;
    return Response.json({ ok: true, coverId: mediaId });
  } catch (error) {
    console.error("[areas:id:media:cover]", error);
    return Response.json({ ok: false, error: "Não foi possível definir a foto de capa." }, { status: 500 });
  }
}
