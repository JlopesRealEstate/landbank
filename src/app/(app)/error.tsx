"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-shell:error]", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Land Bank Corp</p>
      <h1 className="mt-1 text-lg font-semibold text-ink">Falha ao carregar o módulo</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Esta área do CRM encontrou um erro inesperado. Tente novamente; se persistir, volte ao painel executivo.
      </p>
      {error?.message ? (
        <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-paper px-2 py-1.5 text-[10px] text-muted">
          {error.message}
        </pre>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-forest px-3.5 py-2 text-xs font-semibold text-white hover:bg-forest-600"
        >
          Tentar novamente
        </button>
        <Link href="/" className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink hover:border-leaf">
          Ir para o painel
        </Link>
      </div>
    </div>
  );
}
