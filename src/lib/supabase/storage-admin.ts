import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Use the caller's cookie session for identity and role checks, then a server-only key for private Storage reads. */
export function createStorageAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY_V2;
  if (!url || !key) throw new Error("SUPABASE_SECRET_KEY_V2 não configurada na Vercel (Production).");
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export async function getAuthorizedStorageClient() {
  const sessionClient = await createClient() as any;
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error || !user) return { error: "Sessão não autenticada.", status: 401 as const };
  const { data: role, error: roleError } = await sessionClient
    .from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (roleError || !["admin", "member", "reader"].includes(role?.role ?? "")) {
    return { error: "Usuário sem permissão para visualizar os arquivos.", status: 403 as const };
  }
  try {
    return { storageClient: createStorageAdminClient(), user };
  } catch {
    return { error: "Chave privada de Storage não configurada.", status: 503 as const };
  }
}
