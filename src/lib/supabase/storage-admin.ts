import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Use the caller's cookie session for identity and role checks, then a server-only key for private Storage reads. */
export async function getAuthorizedStorageClient() {
  const sessionClient = await createClient() as any;
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return { error: "Sessão não autenticada.", status: 401 as const };
  const { data: role, error: roleError } = await sessionClient
    .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError || !["admin", "member", "reader"].includes(role?.role ?? "")) {
    return { error: "Usuário sem permissão para visualizar os arquivos.", status: 403 as const };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY_V2 || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "Chave privada de Storage não configurada.", status: 503 as const };
  const storageClient = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return { storageClient, user };
}
