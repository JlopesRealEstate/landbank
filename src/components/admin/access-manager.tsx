"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, MailPlus, RefreshCw, ShieldCheck, UserRound, Users } from "lucide-react";

type AccessUser = { id: string; email: string; role: string; lastSignInAt: string | null; createdAt: string };
const ROLE_LABELS: Record<string, string> = { admin: "Administrador", member: "Editor", reader: "Somente leitura", sem_acesso: "Sem acesso" };

export function AccessManager() {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Falha ao consultar usuários.");
      setUsers(data.users ?? []);
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Falha ao consultar usuários." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, role }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Não foi possível enviar o convite.");
      setMessage({ error: false, text: "Convite enviado. O usuário precisa confirmar o e-mail e criar a própria senha." });
      setEmail("");
      setFullName("");
      await load();
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Falha ao enviar convite." });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(user: AccessUser, nextRole: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: nextRole }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Não foi possível alterar o acesso.");
      setMessage({ error: false, text: `Permissão atualizada para ${user.email}.` });
      await load();
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Falha ao alterar acesso." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center gap-2">
          <MailPlus className="h-5 w-5 text-leaf" />
          <h2 className="text-base font-semibold text-ink">Convidar usuário autorizado</h2>
        </div>
        <p className="mt-1 text-sm text-muted">O acesso é criado por convite. A pessoa define a própria senha pelo fluxo oficial do Supabase Auth; não compartilhe senhas por mensagem.</p>
        <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-ink">Nome
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm" placeholder="Nome do colaborador" />
          </label>
          <label className="text-xs font-medium text-ink">E-mail corporativo
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2.5 text-sm" placeholder="nome@empresa.com.br" />
          </label>
          <label className="text-xs font-medium text-ink sm:col-span-1">Perfil inicial
            <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm">
              <option value="member">Editor — cadastrar e editar</option>
              <option value="reader">Somente leitura</option>
              <option value="admin">Administrador — gerenciar acessos</option>
            </select>
          </label>
          <div className="flex items-end">
            <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />} Enviar convite
            </button>
          </div>
        </form>
      </section>

      {message ? <p role="status" className={`rounded-lg border p-3 text-sm ${message.error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-800"}`}>{message.text}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-leaf" /><h2 className="font-semibold text-ink">Contas e permissões</h2></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
        </div>
        {loading ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários...</div> : users.length === 0 ? <p className="p-6 text-sm text-muted">Nenhuma conta encontrada.</p> : (
          <div className="divide-y divide-line">
            {users.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{user.email}</p>
                  <p className="mt-0.5 text-[11px] text-muted">Último acesso: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("pt-BR") : "Ainda não entrou"}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck className="h-4 w-4" />
                  <select disabled={busy} value={user.role} onChange={(event) => void changeRole(user, event.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-ink">
                    <option value="admin">Administrador</option>
                    <option value="member">Editor</option>
                    <option value="reader">Somente leitura</option>
                    <option value="sem_acesso">Revogar acesso</option>
                  </select>
                </label>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="flex items-start gap-2 text-xs leading-5 text-muted"><UserRound className="mt-0.5 h-4 w-4 shrink-0" />Perfis: Administrador gerencia usuários; Editor opera o CRM; Somente leitura consulta os dados. Revogar acesso remove a permissão do CRM sem apagar o histórico da conta.</p>
    </div>
  );
}
