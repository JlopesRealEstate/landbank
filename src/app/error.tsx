"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app:error]", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Land Bank Corp</p>
        <h1 className="mt-1 text-lg font-semibold text-ink">Não foi possível carregar esta tela</h1>
        <p className="mt-2 text-sm text-muted">
          Ocorreu um erro ao renderizar o conteúdo. Você pode tentar novamente — seus dados estão salvos.
        </p>
        {error?.message ? (
          <pre className="mt-3 max-h-28 overflow-auto rounded-lg bg-paper px-2 py-1.5 text-left text-[10px] text-muted">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-forest px-3.5 py-2 text-xs font-semibold text-white hover:bg-forest-600"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink hover:border-leaf"
          >
            Recarregar página
          </button>
          <a
            href="/"
            className="rounded-lg border border-line px-3.5 py-2 text-xs font-medium text-ink hover:border-leaf"
          >
            Ir para o painel
          </a>
        </div>
      </div>
    </main>
  );
}
