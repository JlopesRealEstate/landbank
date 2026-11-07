"use client";

import { useState, type FormEvent } from "react";
import { ImageUp, RefreshCw, Save } from "lucide-react";

export function BrandSettings() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setMessage("Selecione o novo logotipo em JPG."); return; }
    setBusy(true); setMessage(null);
    try {
      const body = new FormData(); body.set("logo", file);
      const response = await fetch("/api/brand/logo", { method: "POST", body, credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Falha ao salvar.");
      setMessage("Logotipo atualizado no banco de dados.");
      setFile(null);
      const input = document.getElementById("brand-logo-file") as HTMLInputElement | null;
      if (input) input.value = "";
      window.dispatchEvent(new Event("brand-logo-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o logotipo.");
    } finally { setBusy(false); }
  }
  return <section className="max-w-2xl rounded-2xl border border-line bg-white p-5">
    <div className="flex items-center gap-2"><ImageUp className="h-5 w-5 text-leaf" /><h2 className="font-semibold">Identidade visual</h2></div>
    <p className="mt-1 text-sm text-muted">O logotipo institucional é armazenado no banco de dados e exibido no CRM e no portal público. Somente administradores podem substituí-lo.</p>
    <div className="mt-4 rounded-xl border border-line bg-paper p-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Logotipo atual</p><img src="/api/brand/logo" alt="Logotipo EldoradoCorp atual" className="max-h-28 max-w-full rounded bg-white object-contain p-2" /></div>
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-xs font-medium">Substituir logotipo (JPG, até 2 MB)
        <input id="brand-logo-file" type="file" accept=".jpg,.jpeg,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full rounded-lg border border-line p-2 text-xs" />
      </label>
      <button disabled={busy || !file} className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar logotipo</button>
      {message ? <p role="status" className="text-xs text-muted">{message}</p> : null}
    </form>
  </section>;
}
