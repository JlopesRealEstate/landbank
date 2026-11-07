import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/authorization";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuração segura do Supabase indisponível.");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  try {
    const admin = adminClient();
    const { data, error } = await admin.from("app_settings").select("value").eq("key", "brand_logo").maybeSingle();
    if (error) throw error;
    const value = data?.value as { data?: string; mimeType?: string } | null;
    if (!value?.data) return new Response("Logo não configurado", { status: 404 });
    const bytes = Buffer.from(value.data, "base64");
    return new Response(bytes, { headers: { "Content-Type": value.mimeType || "image/jpeg", "Cache-Control": "public, max-age=60, s-maxage=300", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("[brand:logo:GET]", error);
    return new Response("Logo indisponível", { status: 503 });
  }
}

export async function POST(request: Request) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;
  try {
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) return Response.json({ ok: false, error: "Selecione um arquivo JPG." }, { status: 400 });
    if (file.type !== "image/jpeg" || file.size < 100 || file.size > 2 * 1024 * 1024) {
      return Response.json({ ok: false, error: "O logotipo deve estar em JPG e ter até 2 MB." }, { status: 415 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const admin = adminClient();
    const { error } = await admin.from("app_settings").upsert({
      key: "brand_logo",
      value: { mimeType: "image/jpeg", fileName: file.name.slice(0, 160), data: bytes.toString("base64") },
      updated_at: new Date().toISOString(),
      updated_by: access.userId,
    }, { onConflict: "key" });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[brand:logo:POST]", error);
    return Response.json({ ok: false, error: "Não foi possível salvar o logotipo." }, { status: 500 });
  }
}
