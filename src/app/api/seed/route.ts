import { ensureDatabase } from "@/db/bootstrap";
import { countAreas } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401 };
  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError) return { ok: false as const, status: 503 };
  if (role?.role !== "admin") return { ok: false as const, status: 403 };
  return { ok: true as const };
}

export async function POST() {
  const access = await requireAdmin();
  if (!access.ok) {
    return Response.json({ ok: false, error: "Acesso administrativo necessário." }, { status: access.status });
  }
  try {
    await ensureDatabase();
    const total = await countAreas();
    return Response.json({ ok: true, areas: total, message: "Base regional verificada e semeada com sucesso." });
  } catch (error) {
    console.error("[seed:POST]", error);
    return Response.json({ ok: false, error: "Falha ao preparar a base." }, { status: 500 });
  }
}
