"use client";

import { Printer } from "lucide-react";

export function DocumentacaoPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs font-medium text-ink hover:border-[#8c2f43] hover:text-[#8c2f43]"
    >
      <Printer className="h-3.5 w-3.5" /> Imprimir esta página
    </button>
  );
}
