import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101114] px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1b20] p-8 text-center shadow-2xl">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="mt-4 text-2xl font-semibold">Acesso não autorizado</h1>
        <p className="mt-2 text-sm leading-6 text-white/65">
          Sua conta está autenticada, mas ainda não possui uma permissão ativa no Land Bank Corp.
          Solicite ao administrador que envie um convite e atribua seu perfil de acesso.
        </p>
        <Link href="/login" className="mt-6 inline-flex rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
