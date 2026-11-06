import { createClient } from "@/lib/supabase/server";
import { MAX_UPLOAD_BYTES, safeFileName } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const BUCKET = "landbank-files";
const MAX_PHOTOS = 100;

export async function POST(request: Request, { params }: Params) {
  const areaId = Number((await params).id);
  if (!Number.isSafeInteger(areaId) || areaId <= 0) {
    return Response.json({ ok: false, error: "ID do imóvel inválido." }, { status: 400 });
  }

  try {
    // Gera o token no servidor, onde a sessão SSR é validada pelos cookies.
    // O navegador não precisa executar INSERT em storage.objects diretamente.
    const supabase = await createClient() as any;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;
    if (authError || !userId) {
      return Response.json({ ok: false, error: "Sessão expirada. Entre novamente no CRM." }, { status: 401 });
    }

    const { data: area, error: areaError } = await supabase.from("areas").select("id").eq("id", areaId).maybeSingle();
    if (areaError) throw areaError;
    if (!area) return Response.json({ ok: false, error: "Imóvel não encontrado ou sem permissão." }, { status: 404 });

    const body = await request.json().catch(() => null) as {
      kind?: "photo" | "document";
      files?: Array<{ name?: string; size?: number; mimeType?: string }>;
    } | null;
    if (!body || !Array.isArray(body.files) || body.files.length === 0 || body.files.length > 20) {
      return Response.json({ ok: false, error: "Selecione de 1 a 20 arquivos por envio." }, { status: 400 });
    }
    const kind = body.kind === "photo" ? "photo" : "document";
    for (const file of body.files) {
      const size = Number(file.size);
      if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
        return Response.json({ ok: false, error: "Cada arquivo deve ter até 9 MB." }, { status: 413 });
      }
      if (kind === "photo" && typeof file.mimeType === "string" && !file.mimeType.startsWith("image/")) {
        return Response.json({ ok: false, error: `"${file.name ?? "Arquivo"}" não é uma imagem válida.` }, { status: 415 });
      }
    }

    if (kind === "photo") {
      const { count, error: countError } = await supabase.from("media")
        .select("id", { count: "exact", head: true })
        .eq("area_id", areaId).eq("kind", "photo");
      if (countError) throw countError;
      const current = count ?? 0;
      if (current + body.files.length > MAX_PHOTOS) {
        return Response.json({
          ok: false,
          error: `Limite de ${MAX_PHOTOS} fotos por imóvel. Esta ficha já possui ${current}; você pode adicionar mais ${Math.max(0, MAX_PHOTOS - current)}.`,
        }, { status: 409 });
      }
    }

    const uploads = [];
    for (const file of body.files) {
      const name = safeFileName(typeof file.name === "string" ? file.name : "arquivo");
      const path = `${areaId}/${crypto.randomUUID()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data?.token) {
        console.error("[media:upload-url]", error);
        throw new Error(error?.message ?? "Não foi possível autorizar o envio ao armazenamento.");
      }
      uploads.push({ path, token: data.token, name, size: Number(file.size), mimeType: file.mimeType || "application/octet-stream" });
    }

    return Response.json({ ok: true, uploads }, { status: 200 });
  } catch (error) {
    console.error("[media:upload-url:POST]", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: `Não foi possível autorizar o upload: ${message.slice(0, 180)}` }, { status: 500 });
  }
}
