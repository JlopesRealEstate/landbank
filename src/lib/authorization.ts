import { createClient } from "@/lib/supabase/server";

/** Authorization enforced on the server; UI visibility is not a security boundary. */
export async function requireAdmin(): Promise<{ userId: string } | { response: Response }> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: Response.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }) };
  const { data: role, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError) return { response: Response.json({ ok: false, error: "Não foi possível validar as permissões." }, { status: 503 }) };
  if (role?.role !== "admin") return { response: Response.json({ ok: false, error: "Somente administradores podem alterar os dados." }, { status: 403 }) };
  return { userId: user.id };
}
