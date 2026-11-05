"use client";

import { useState } from "react";
import { ArrowUpRight, Clock, Newspaper, RefreshCw } from "lucide-react";
import type { NewsItem } from "@/db/schema";
import { cn } from "@/components/ui";

type Snapshot = {
  day: string;
  items: NewsItem[];
  indices: { label: string; value: string; unit: string; note: string }[];
  source: string;
  fetchedAt: string;
  stale: boolean;
  live: boolean;
};

/** Rótulo curto da fonte (ex.: "InfoMoney", "Exame"). */
function shortSource(source: string): string {
  const clean = source.replace(/\s*[-|].*$/, "").replace(/\.com\.br.*$/i, "").trim();
  return clean.length > 22 ? `${clean.slice(0, 21)}…` : clean;
}

/** Link curto e legível: domínio + caminho resumido. */
function shortUrl(link: string): string {
  try {
    const url = new URL(link);
    const path = url.pathname.replace(/\/$/, "");
    const short = path.length > 22 ? `${path.slice(0, 21)}…` : path;
    return `${url.hostname.replace(/^www\./, "")}${short}`;
  } catch {
    return link.slice(0, 32);
  }
}

export function MarketNews({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("todas");

  const categories = ["todas", ...new Set(snapshot.items.map((item) => item.category))];
  const items = filter === "todas" ? snapshot.items : snapshot.items.filter((item) => item.category === filter);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/news", { method: "POST" });
      const data = (await response.json()) as { ok: boolean } & Snapshot;
      if (!data.ok) throw new Error("Falha ao atualizar as notícias.");
      setSnapshot(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao atualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Radar diário</p>
          <h2 className="mt-0.5 flex items-center gap-1.5 text-base font-semibold text-ink">
            <Newspaper className="h-4 w-4 text-[#8c2f43]" /> Notícias do mercado corporativo
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> atualizado em{" "}
              {new Date(snapshot.fetchedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
            <span>· coleta automática diária</span>
            {snapshot.live ? (
              <span className="rounded-full bg-leaf-50 px-1.5 py-0.5 font-semibold text-leaf-600">ao vivo</span>
            ) : (
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">conteúdo curado</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[10px] font-medium text-ink hover:border-[#8c2f43] hover:text-[#8c2f43] disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Atualizar agora
        </button>
      </div>

      <div className="grid gap-2 border-b border-line bg-paper/40 px-4 py-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {snapshot.indices.map((index) => (
          <div key={index.label} className="rounded-lg border border-line bg-white px-2 py-1.5">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{index.label}</p>
            <p className="text-[15px] font-semibold tabular-nums text-ink">
              {index.value} <span className="text-[10px] font-normal text-muted">{index.unit}</span>
            </p>
            <p className="text-[9.5px] text-muted">{index.note}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-line px-4 py-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition",
              filter === category
                ? "border-[#8c2f43] bg-[#f6e8eb] text-[#8c2f43]"
                : "border-line bg-white text-muted hover:border-[#8c2f43]/40",
            )}
          >
            {category}
          </button>
        ))}
        <span className="ml-auto text-[9px] text-muted">{snapshot.source}</span>
      </div>

      {error ? <p className="bg-[#f6e8eb] px-4 py-2 text-[10px] text-[#8c2f43]">{error}</p> : null}

      <div className="grid gap-2.5 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.slice(0, 9).map((item, index) => (
          <a
            key={`${item.link}-${index}`}
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col justify-between rounded-xl border border-line bg-white p-3 transition hover:-translate-y-0.5 hover:border-[#8c2f43]/40 hover:shadow-sm"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate rounded bg-paper px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-ink-soft">
                  {item.category}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-muted">
                  {shortSource(item.source)}
                  <ArrowUpRight className="h-3 w-3 opacity-50 transition group-hover:opacity-100" />
                </span>
              </div>
              <p className="mt-1.5 line-clamp-3 text-[12.5px] font-semibold leading-snug text-ink group-hover:text-[#8c2f43]">
                {item.title}
              </p>
              {item.summary ? (
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted">{item.summary}</p>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-dashed border-line pt-1.5 text-[9.5px] text-muted">
              <span className="truncate">{shortUrl(item.link)}</span>
              <span className="shrink-0">
                {new Date(item.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </span>
            </div>
          </a>
        ))}
      </div>

      <p className="border-t border-line px-4 py-2 text-[8.5px] leading-relaxed text-muted">
        Coleta automática diária de fontes públicas (Google News, InfoMoney, Exame e Money Times). O snapshot do dia fica
        gravado no CRM; se a fonte estiver indisponível, o último conteúdo válido é mantido. Índices são referências de
        mercado da Land Bank Corp, não cotação oficial.
      </p>
    </div>
  );
}
