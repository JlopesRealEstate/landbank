"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      window.location.assign(safeNextPath(new URLSearchParams(window.location.search).get("next")));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar. Verifique suas credenciais.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101114] px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1b20] p-8 shadow-2xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400">EldoradoCorp</p>
          <h1 className="mt-3 text-3xl font-semibold">Acesso ao CRM</h1>
          <p className="mt-2 text-sm text-white/60">Entre com seu usuário corporativo autorizado.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm text-white/75">E-mail
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400" />
          </label>
          <label className="block text-sm text-white/75">Senha
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400" />
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60">{busy ? "Entrando..." : "Entrar"}</button>
        </form>
        <p className="mt-6 text-xs leading-5 text-white/40">Novas contas são liberadas exclusivamente por convite de um administrador do Land Bank Corp. O cadastro público não é permitido.</p>
      </section>
    </main>
  );
}
