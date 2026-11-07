import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { db } from "@/db";
import { areas } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY_V2 || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("Public image delivery is not configured", { status: 503 });
  try {
    const admin = createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: item, error } = await admin.from("media").select("id,area_id,kind,mime_type,name,storage_path,external_url,data").eq("id", id).eq("kind", "photo").maybeSingle();
    if (error || !item) return new Response("Not found", { status: 404 });
    const [area] = await db.select({ status: areas.status }).from(areas).where(eq(areas.id, item.area_id)).limit(1);
    if (!area || area.status !== "disponivel") return new Response("Not found", { status: 404 });
    if (item.external_url && !item.storage_path && !item.data) {
      const external = new URL(item.external_url);
      if (external.protocol !== "https:") return new Response("Invalid URL", { status: 400 });
      return Response.redirect(external.toString(), 302);
    }
    if (item.storage_path) {
      const { data, error: signError } = await admin.storage.from("landbank-files").createSignedUrl(item.storage_path, 600);
      if (signError || !data?.signedUrl) return new Response("Image unavailable", { status: 404 });
      return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "public, max-age=60, s-maxage=60" } });
    }
    if (item.data) {
      const bytes = Buffer.from(item.data, "base64");
      return new Response(bytes, { headers: { "Content-Type": item.mime_type || "image/jpeg", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
    }
    return new Response("Image unavailable", { status: 404 });
  } catch (error) {
    console.error("[public:media]", error);
    return new Response("Image unavailable", { status: 500 });
  }
}
