import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };
const BUCKET = "landbank-files";

export async function GET(request: Request, { params }: Params) {
  const mediaId = Number((await params).id);
  if (!Number.isInteger(mediaId)) return new Response("ID inválido", { status: 400 });
  try {
    const supabase = await createClient() as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response("Não autenticado", { status: 401 });

    const { data: row, error } = await supabase.from("media")
      .select("name,mime_type,data,storage_path,external_url")
      .eq("id", mediaId).maybeSingle();
    if (error) throw error;
    if (!row) return new Response("Arquivo não encontrado", { status: 404 });

    if (row.external_url && !row.storage_path && !row.data) {
      const url = new URL(row.external_url);
      if (url.protocol !== "https:" && url.protocol !== "http:") return new Response("Link inválido", { status: 400 });
      return Response.redirect(url.toString(), 302);
    }

    let bytes: Uint8Array;
    if (row.storage_path) {
      const { data: file, error: downloadError } = await supabase.storage.from(BUCKET).download(row.storage_path);
      if (downloadError || !file) return new Response("Arquivo indisponível", { status: 404 });
      bytes = new Uint8Array(await file.arrayBuffer());
    } else if (row.data) {
      bytes = new Uint8Array(Buffer.from(row.data, "base64"));
    } else {
      return new Response("Arquivo indisponível", { status: 404 });
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Blob([bytes as unknown as BlobPart]), {
      headers: {
        "Content-Type": row.mime_type || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(row.name)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[media:GET]", error);
    return new Response("Não foi possível carregar o arquivo", { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const mediaId = Number((await params).id);
  if (!Number.isInteger(mediaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  try {
    const supabase = await createClient() as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ ok: false, error: "Não autenticado." }, { status: 401 });

    const { data: row, error: readError } = await supabase.from("media")
      .select("id,storage_path").eq("id", mediaId).maybeSingle();
    if (readError) throw readError;
    if (!row) return Response.json({ ok: false, error: "Arquivo não encontrado." }, { status: 404 });

    if (row.storage_path) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
      if (storageError) throw storageError;
    }
    const { error: deleteError } = await supabase.from("media").delete().eq("id", mediaId);
    if (deleteError) throw deleteError;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[media:DELETE]", error);
    return Response.json({ ok: false, error: "Não foi possível remover o arquivo. A exclusão exige perfil administrador." }, { status: 403 });
  }
}
