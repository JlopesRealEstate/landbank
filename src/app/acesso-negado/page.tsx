"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AccessDeniedPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101114] px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1b20] p-8 text-center shadow-2xl">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="mt-4 text-2xl font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Sua conta está autenticada, mas ainda não possui uma permissão ativa no Land Bank Corp.
          Solicite ao administrador um convite e a atribuição do seu perfil de acesso.
        </p>
        <button type="button" onClick={() => void signOut()} disabled={busy} className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sair da conta
        </button>
      </section>
    </main>
  );
}
