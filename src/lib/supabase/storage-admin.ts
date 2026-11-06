import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Private media is read with the authenticated user session and explicit RLS policies. */
export async function getAuthorizedStorageClient() {
  const sessionClient = await createClient();
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return { error: "Sessão não autenticada.", status: 401 as const };
  const { data: role, error: roleError } = await sessionClient
    .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError || !["admin", "member", "reader"].includes(role?.role ?? "")) {
    return { error: "Usuário sem permissão para visualizar os arquivos.", status: 403 as const };
  }
  return { storageClient: sessionClient, user };
}
