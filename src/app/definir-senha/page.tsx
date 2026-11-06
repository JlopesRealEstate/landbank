"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DefinePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Supabase JS detects and processes recovery tokens in the URL hash
    // before this page asks for the current session (implicit-flow compatibility).
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashError = hash.get("error_description") || hash.get("error");
    if (hashError) {
      setError(hashError.includes("expired") || hash.get("error_code") === "otp_expired"
        ? "Este link de recuperação expirou ou já foi utilizado. Solicite um novo link na tela de login."
        : "O link de recuperação não pôde ser validado. Solicite um novo link.");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setHasSession(Boolean(data.session));
      if (sessionError) setError("Não foi possível validar o link. Solicite uma nova recuperação de senha.");
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHasSession(Boolean(session));
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!hasSession) {
      setError("O link ainda não autenticou sua sessão. Volte ao login e solicite um novo link de recuperação.");
      return;
    }
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Sua sessão de recuperação expirou. Solicite um novo link.");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Senha atualizada. Redirecionando para o CRM...");
      router.replace("/login?password_updated=1");
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
        <h1 className="mt-4 text-2xl font-semibold">Defina sua nova senha</h1>
        <p className="mt-2 text-sm leading-6 text-white/60">Crie uma senha exclusiva com pelo menos 12 caracteres.</p>
        {checking ? <p role="status" className="mt-4 text-sm text-white/60">Validando link de recuperação...</p> : null}
        {!checking && !hasSession ? <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">O formulário está disponível, mas o link ainda não foi validado. Solicite um novo link de recuperação na tela de login e abra o e-mail mais recente.</p> : null}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-white/75">Nova senha
            <input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400" />
          </label>
          <label className="block text-sm text-white/75">Confirmar nova senha
            <input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-3 text-white outline-none focus:border-amber-400" />
          </label>
          {error ? <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
          {notice ? <p role="status" className="rounded-lg border border-green-400/30 bg-green-400/10 p-3 text-sm text-green-200">{notice}</p> : null}
          <button disabled={busy || checking || !hasSession} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 font-semibold text-black disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar nova senha
          </button>
          <a href="/login" className="block text-center text-sm text-white/60 hover:text-amber-300">Voltar ao login</a>
        </form>
      </section>
    </main>
  );
}
