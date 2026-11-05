"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { getHelp, type HelpLookup } from "@/lib/help";
import { cn } from "@/components/ui";

/**
 * Ícone de ajuda (?) para cada campo.
 * Desktop: abre ao passar o mouse / focar. Mobile: abre ao tocar e fecha pelo X
 * ou tocando fora. Nunca usa title nativo — texto sempre legível e detalhado.
 */
export function FieldHelp({
  helpKey,
  label,
  className,
  align = "left",
}: {
  helpKey: string;
  label?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const entry: HelpLookup | null = getHelp(helpKey);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!entry) return null;

  return (
    <span
      ref={containerRef}
      className={cn("relative inline-flex align-middle", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Ajuda do campo ${label ?? entry.label}`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        onFocus={() => setOpen(true)}
        className={cn(
          "inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border text-[9px] font-bold transition",
          open
            ? "border-[#8c2f43] bg-[#8c2f43] text-white"
            : "border-line bg-white text-muted hover:border-[#8c2f43] hover:text-[#8c2f43]",
        )}
      >
        ?
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`Explicação: ${label ?? entry.label}`}
          className={cn(
            "absolute top-5 z-[1300] w-[300px] max-w-[85vw] rounded-xl border border-line bg-white p-3 text-left shadow-xl sm:w-[330px]",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold text-ink">{entry.label}</p>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }}
              className="rounded p-0.5 text-muted hover:text-ink"
              aria-label="Fechar ajuda"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8c2f43]">O que é</p>
          <p className="text-[10.5px] leading-relaxed text-ink-soft">{entry.what}</p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8c2f43]">Como preencher</p>
          <p className="text-[10.5px] leading-relaxed text-ink-soft">{entry.how}</p>
          {entry.technical ? (
            <>
              <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8c2f43]">Detalhe técnico</p>
              <p className="text-[10px] leading-relaxed text-muted">{entry.technical}</p>
            </>
          ) : null}
          {entry.example ? (
            <p className="mt-1.5 rounded bg-paper px-1.5 py-1 text-[9.5px] text-ink-soft">
              Exemplo: <strong>{entry.example}</strong>
            </p>
          ) : null}
          <Link
            href={`/documentacao#${entry.group}`}
            className="mt-2 inline-flex items-center gap-1 text-[9.5px] font-semibold text-leaf-600 hover:underline"
            onClick={() => setOpen(false)}
          >
            Ver documentação completa
          </Link>
        </div>
      ) : null}
    </span>
  );
}

/** Botão “Ajuda” para cabeçalhos de página/secção. */
export function HelpButton({ helpKey, label }: { helpKey: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-[9.5px] text-muted">
      <HelpCircle className="h-3 w-3" />
      ajuda
      <FieldHelp helpKey={helpKey} label={label} />
    </span>
  );
}
