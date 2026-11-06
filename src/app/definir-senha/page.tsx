"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DefinePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Use uma senha com pelo menos 12 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível definir a senha.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101114] px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1b20] p-8 shadow-2xl">
        <KeyRound className="h-8 w-8 text-amber-400" />
        <h1 className="mt-4 text-2xl font-semibold">Defina sua senha</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">Crie uma senha exclusiva com pelo menos 12 caracteres. Não reutilize senhas de outros serviços.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-white/75">Nova senha
            <input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400" />
          </label>
          <label className="block text-sm text-white/75">Confirmar senha
            <input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400" />
          </label>
          {error ? <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-semibold text-black disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar senha e entrar
          </button>
        </form>
      </section>
    </main>
  );
}
