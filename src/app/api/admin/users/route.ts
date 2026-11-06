import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getAdminContext() {
  const sessionClient = await createClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  const user = authData?.user ?? null;
  if (authError || !user) return { error: Response.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };

  const { data: role, error: roleError } = await (sessionClient as any)
    .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError || role?.role !== "admin") {
    return { error: Response.json({ ok: false, error: "Somente administradores podem gerenciar acessos." }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { error: Response.json({ ok: false, error: "Configure SUPABASE_SERVICE_ROLE_KEY somente no ambiente server-side da Vercel para habilitar convites administrativos." }, { status: 503 }) };
  }
  const admin = createSupabaseAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { admin, user };
}

export async function GET() {
  try {
    const context = await getAdminContext();
    if ("error" in context) return context.error;
    const [{ data: usersData, error: usersError }, { data: roles, error: rolesError }] = await Promise.all([
      context.admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      context.admin.from("user_roles").select("user_id,role,created_at"),
    ]);
    if (usersError) throw usersError;
    if (rolesError) throw rolesError;
    const roleMap = new Map((roles ?? []).map((item) => [item.user_id, item.role]));
    const users = (usersData.users ?? []).map((item) => ({
      id: item.id,
      email: item.email ?? "",
      role: roleMap.get(item.id) ?? "sem_acesso",
      lastSignInAt: item.last_sign_in_at ?? null,
      createdAt: item.created_at,
    }));
    return Response.json({ ok: true, users });
  } catch (error) {
    console.error("[admin:users:GET]", error);
    return Response.json({ ok: false, error: "Não foi possível carregar os usuários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getAdminContext();
    if ("error" in context) return context.error;
    const body = await request.json().catch(() => ({})) as { email?: string; role?: string; fullName?: string };
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "member");
    const fullName = String(body.fullName ?? "").trim().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ ok: false, error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (!["admin", "member", "reader"].includes(role)) {
      return Response.json({ ok: false, error: "Perfil inválido." }, { status: 400 });
    }

    const { data: invited, error: inviteError } = await context.admin.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : {},
      redirectTo: new URL("/auth/callback?next=/definir-senha", request.url).toString(),
    });
    if (inviteError) throw inviteError;
    if (!invited.user?.id) throw new Error("O Supabase não retornou o identificador do usuário convidado.");

    const { error: roleError } = await context.admin.from("user_roles").upsert({
      user_id: invited.user.id,
      role,
    }, { onConflict: "user_id" });
    if (roleError) {
      await context.admin.auth.admin.deleteUser(invited.user.id);
      throw roleError;
    }
    return Response.json({ ok: true, userId: invited.user.id, email, role }, { status: 201 });
  } catch (error) {
    console.error("[admin:users:POST]", error);
    const detail = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: detail.slice(0, 220) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getAdminContext();
    if ("error" in context) return context.error;
    const body = await request.json().catch(() => ({})) as { userId?: string; role?: string };
    const userId = String(body.userId ?? "");
    const role = String(body.role ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !["admin", "member", "reader", "sem_acesso"].includes(role)) {
      return Response.json({ ok: false, error: "Usuário ou perfil inválido." }, { status: 400 });
    }
    if (userId === context.user.id && role !== "admin") {
      return Response.json({ ok: false, error: "Não é permitido remover seu próprio perfil administrador." }, { status: 409 });
    }
    const { data: currentRole } = await context.admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (currentRole?.role === "admin" && role !== "admin") {
      const { count, error: countError } = await context.admin.from("user_roles")
        .select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if (countError) throw countError;
      if ((count ?? 0) <= 1) {
        return Response.json({ ok: false, error: "O CRM precisa manter pelo menos um administrador ativo." }, { status: 409 });
      }
    }
    if (role === "sem_acesso") {
      const { error } = await context.admin.from("user_roles").delete().eq("user_id", userId);
      if (error) throw error;
    } else {
      const { error } = await context.admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id" });
      if (error) throw error;
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[admin:users:PATCH]", error);
    return Response.json({ ok: false, error: "Não foi possível alterar o acesso." }, { status: 500 });
  }
}
