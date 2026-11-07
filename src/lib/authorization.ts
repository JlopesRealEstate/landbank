import { createClient } from "@/lib/supabase/server";

/** Authorization enforced on the server; UI visibility is not a security boundary. */
export async function requireEditor(): Promise<{ userId: string } | { response: Response }> {
  const supabase = await createClient() as any;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: Response.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  const { data: role, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError) return { response: Response.json({ ok: false, error: "Não foi possível validar as permissões." }, { status: 503 }) };
  if (role?.role !== "admin" && role?.role !== "member") return { response: Response.json({ ok: false, error: "Seu perfil permite somente consulta. Solicite perfil Editor ao administrador." }, { status: 403 }) };
  return { userId: user.id };
}


/** Operações administrativas: gestão de usuários, configurações globais e exclusões críticas. */
export async function requireAdmin(): Promise<{ userId: string } | { response: Response }> {
  const access = await requireEditor();
  if ("response" in access) return access;
  const supabase = await createClient() as any;
  const { data: role, error } = await supabase.from("user_roles").select("role").eq("user_id", access.userId).maybeSingle();
  if (error) return { response: Response.json({ ok: false, error: "Não foi possível validar as permissões." }, { status: 503 }) };
  if (role?.role !== "admin") return { response: Response.json({ ok: false, error: "Somente administradores podem executar esta operação." }, { status: 403 }) };
  return access;
}
