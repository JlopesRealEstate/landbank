import Link from "next/link";
import { BrandMark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-7 text-center shadow-sm">
        <div className="flex justify-center">
          <BrandMark className="h-11 w-11" />
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Land Bank Corp</p>
        <h1 className="mt-1 text-xl font-semibold">Ativo não encontrado</h1>
        <p className="mt-2 text-sm text-muted">
          O dossiê ou a página que você tentou abrir não existe ou foi removido do portfólio.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className="rounded-lg bg-forest px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-forest-600">
            Ir para o painel
          </Link>
          <Link href="/areas" className="rounded-lg border border-line px-3.5 py-2.5 text-xs font-medium hover:border-leaf hover:text-leaf-600">
            Ver áreas
          </Link>
        </div>
      </div>
    </main>
  );
}
