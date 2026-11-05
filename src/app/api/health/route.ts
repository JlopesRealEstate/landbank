import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ ok: false, service: "supabase-auth", authenticated: false }, { status: 401 });
    }

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      return Response.json({ ok: false, service: "supabase-database", authenticated: true, error: "Não foi possível consultar o perfil." }, { status: 503 });
    }

    return Response.json({
      ok: true,
      service: "supabase",
      authenticated: true,
      role: role?.role ?? "member",
      user: user.email,
    });
  } catch {
    return Response.json({ ok: false, service: "supabase", error: "Serviço indisponível." }, { status: 503 });
  }
}
