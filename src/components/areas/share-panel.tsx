"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { cn } from "@/components/ui";
import { CONTACT } from "@/lib/contact";
import { FieldHelp } from "@/components/ui/field-help";

type SharePayload = { text: string; subject: string; whatsappUrl: string; link: string };

export function SharePanel({ areaId, compact = false }: { areaId: number; compact?: boolean }) {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/areas/${areaId}/share`)
      .then((response) => response.json())
      .then((data: { ok: boolean } & SharePayload) => {
        if (!active || !data.ok) return;
        setPayload(data);
        setMessage(
          `Olá! Segue o dossiê do ativo ${data.subject}. Qualquer dúvida estou à disposição para agendar uma visita.`,
        );
      })
      .catch(() => setFeedback({ tone: "error", text: "Não foi possível preparar a mensagem." }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [areaId]);

  async function copy(value: string, kind: "text" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setFeedback({ tone: "error", text: "Copie manualmente o conteúdo do dossiê." });
    }
  }

  async function sendEmail() {
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/areas/${areaId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, message }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        mode?: string;
        fallback?: string;
        message?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Falha no envio.");
      if (data.mode === "mailto" && data.fallback) {
        window.location.href = data.fallback;
        setFeedback({ tone: "info", text: data.message ?? "Abrindo seu aplicativo de e-mail…" });
      } else {
        setFeedback({ tone: "ok", text: data.message ?? "Dossiê enviado." });
      }
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Falha no envio." });
    } finally {
      setSending(false);
    }
  }

  const fullText = payload ? `${message}\n\n${payload.text}` : "";
  const whatsappHref = payload ? CONTACT.whatsapp(`${message}\n\n${payload.text}`) : undefined;

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-leaf" />
        <h3 className="flex items-center gap-1 text-sm font-semibold">
          Enviar dossiê ao cliente <FieldHelp helpKey="mapa.share" label="Enviar ao cliente" />
        </h3>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando apresentação…
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#128C4A] px-3 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#0f7a41]"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Enviar por WhatsApp
            </a>
            <button
              type="button"
              onClick={() => payload && copy(fullText, "text")}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2.5 text-[11px] font-medium text-ink hover:border-leaf"
            >
              {copied === "text" ? <Check className="h-3.5 w-3.5 text-leaf" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "text" ? "Mensagem copiada" : "Copiar mensagem"}
            </button>
          </div>

          <div className="rounded-lg border border-line bg-paper/50 p-2.5">
            <label className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Mensagem ao cliente</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={2}
              className="mt-1 w-full resize-none bg-transparent text-[11px] text-ink outline-none"
            />
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] font-medium text-leaf-600">Ver resumo completo</summary>
              <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2 text-[10px] leading-relaxed text-ink-soft">
                {payload?.text}
              </pre>
            </details>
          </div>

          <div>
            <label className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Enviar por e-mail</label>
            <div className="mt-1 flex gap-1.5">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-2">
                <Mail className="h-3.5 w-3.5 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="cliente@empresa.com.br"
                  className="w-full bg-transparent text-[11px] outline-none placeholder:text-muted/70"
                />
              </div>
              <button
                type="button"
                onClick={() => void sendEmail()}
                disabled={sending || !email}
                className="inline-flex items-center gap-1 rounded-lg bg-forest px-3 py-2 text-[11px] font-medium text-white hover:bg-forest-600 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => payload && copy(payload.link, "link")}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2 text-[10px] font-medium text-muted hover:border-leaf hover:text-leaf-600"
          >
            {copied === "link" ? <Check className="h-3 w-3 text-leaf" /> : <Copy className="h-3 w-3" />}
            {copied === "link" ? "Link copiado" : "Copiar link público da apresentação"}
          </button>

          {feedback ? (
            <p
              className={cn(
                "rounded-lg px-2.5 py-2 text-[10px] leading-snug",
                feedback.tone === "ok" && "bg-leaf-50 text-leaf-600",
                feedback.tone === "error" && "bg-red-50 text-red-700",
                feedback.tone === "info" && "bg-sky-50 text-sky-700",
              )}
            >
              {feedback.text}
            </p>
          ) : null}
          <p className="text-[9px] leading-relaxed text-muted">
            O link contém o dossiê completo com fotos, documentos, mapa interativo e indicadores IBGE. Para envio
            automático configurado no servidor, defina a variável <code>RESEND_API_KEY</code>.
          </p>
        </>
      )}
    </div>
  );
}
