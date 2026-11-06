"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Camera, FileText, LayoutGrid, List, MapPin, Search, ShieldAlert } from "lucide-react";
import type { MapArea } from "@/lib/map-types";
import { ALQUEIRE_PAULISTA_M2, KIND_LABELS, STATUS_LABELS, areaLabel, brl, num } from "@/lib/format";
import { Card, KindBadge, ScorePill, StatusBadge, cn } from "@/components/ui";

type SortKey = "score" | "price" | "area" | "recent";

export function AreaDirectory({ areas }: { areas: MapArea[] }) {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("todos");
  const [kind, setKind] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [sort, setSort] = useState<SortKey>("score");
  const [view, setView] = useState<"grid" | "list">("grid");

  const cityOptions = useMemo(() => [...new Set(areas.map((area) => area.city))].sort(), [areas]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const result = areas.filter((area) => {
      if (city !== "todos" && area.city !== city) return false;
      if (kind !== "todos" && area.kind !== kind) return false;
      if (status !== "todos" && area.status !== status) return false;
      if (!term) return true;
      return `${area.name} ${area.code} ${area.city} ${area.neighborhood} ${area.address} ${area.zoning}`
        .toLowerCase()
        .includes(term);
    });
    if (sort === "recent") return result;
    return result.sort((a, b) => {
      if (sort === "price") return b.totalPrice - a.totalPrice;
      if (sort === "area") return b.landAreaM2 - a.landAreaM2;
      return b.score - a.score;
    });
  }, [areas, query, city, kind, status, sort]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-line bg-paper/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por código, nome, bairro, endereço ou zoneamento"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
          />
        </div>
        <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
          <option value="todos">Todos os municípios</option>
          {cityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(event) => setKind(event.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
          <option value="todos">Todos os tipos</option>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
          <option value="todos">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
          <option value="score">Ordenar por Land Score</option>
          <option value="price">Maior valor total</option>
          <option value="area">Maior área</option>
          <option value="recent">Mais recentes</option>
        </select>
        <div className="flex items-center rounded-lg border border-line bg-paper p-0.5">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={cn("rounded-md p-1.5", view === "grid" ? "bg-white shadow-sm text-ink" : "text-muted")}
            aria-label="Visualização em cartões"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn("rounded-md p-1.5", view === "list" ? "bg-white shadow-sm text-ink" : "text-muted")}
            aria-label="Visualização em lista"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {filtered.length} ativo(s) encontrados — {areaLabel(filtered.reduce((sum, area) => sum + area.landAreaM2, 0))} de
          terreno mapeado
        </p>
        <Link href="/mapa" className="text-[11px] font-medium text-leaf-600 hover:underline">
          Ver no mapa →
        </Link>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">Nenhum ativo encontrado com os filtros atuais.</Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((area) => (
            <Link
              key={area.id}
              href={`/areas/${area.id}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-44 overflow-hidden bg-paper-deep">
                {area.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={area.coverUrl} alt={area.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">Sem foto cadastrada</div>
                )}
                <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
                  <StatusBadge status={area.status} />
                  {area.environmentalRestriction ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
                      <ShieldAlert className="h-3 w-3" /> restrição
                    </span>
                  ) : null}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-forest/85 via-forest/25 to-transparent px-3 pb-2.5 pt-8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e9b7c1]">{area.code}</p>
                  <p className="line-clamp-1 text-sm font-semibold text-white">{area.name}</p>
                  <p className="flex items-center gap-1 text-[10px] text-white/70">
                    <MapPin className="h-2.5 w-2.5" /> {area.city}
                    {area.neighborhood ? ` · ${area.neighborhood}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted">Valor total</p>
                    <p className="text-base font-semibold tabular-nums">{brl(area.totalPrice)}</p>
                    <p className="text-[10px] text-muted">{brl(area.pricePerM2)}/m²</p>
                  </div>
                  <ScorePill score={area.score} grade={area.grade} />
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-paper/70 px-1 py-1.5">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted">m²</p>
                    <p className="text-[11px] font-semibold tabular-nums">{num(area.landAreaM2)}</p>
                  </div>
                  <div className="rounded-lg bg-paper/70 px-1 py-1.5">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted">alq</p>
                    <p className="text-[11px] font-semibold tabular-nums">{num(area.landAreaM2 / ALQUEIRE_PAULISTA_M2, 2)}</p>
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted">ha</p>
                    <p className="text-[11px] font-semibold tabular-nums">{num(area.landAreaM2 / 10_000, 2)}</p>
                  </div>
                  <div className="rounded-lg bg-paper/70 px-1 py-1.5">
                  </div>
                  <div className="rounded-lg bg-paper/70 px-1 py-1.5">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted">construção</p>
                    <p className="text-[11px] font-semibold tabular-nums">{area.builtAreaM2 > 0 ? `${num(area.builtAreaM2)} m²` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-paper/70 px-1 py-1.5">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted">dossiê</p>
                    <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold">
                      <Camera className="h-3 w-3" /> {area.photoCount}
                      <FileText className="h-3 w-3" /> {area.documentCount}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-line pt-2.5">
                  <KindBadge kind={area.kind} />
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-leaf-600">
                    Abrir dossiê <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Código</th>
                  <th className="px-3 py-2.5 font-semibold">Ativo</th>
                  <th className="px-3 py-2.5 font-semibold">Município / bairro</th>
                  <th className="px-3 py-2.5 font-semibold">Tipo</th>
                  <th className="px-3 py-2.5 font-semibold">Terreno</th>
                  <th className="px-3 py-2.5 font-semibold">R$/m²</th>
                  <th className="px-3 py-2.5 font-semibold">Valor total</th>
                  <th className="px-3 py-2.5 font-semibold">Score</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {filtered.map((area) => (
                  <tr key={area.id} className="hover:bg-paper/40">
                    <td className="px-4 py-2.5 font-semibold uppercase text-muted">{area.code}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/areas/${area.id}`} className="font-medium text-ink hover:text-leaf-600">
                        {area.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">
                      {area.city}
                      {area.neighborhood ? ` · ${area.neighborhood}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <KindBadge kind={area.kind} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {num(area.landAreaM2)} m²
                      <span className="block text-[9px] text-muted">
                        {num(area.landAreaM2 / 10_000, 2)} ha · {num(area.landAreaM2 / ALQUEIRE_PAULISTA_M2, 2)} alq
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{brl(area.pricePerM2)}</td>
                    <td className="px-3 py-2.5 font-medium tabular-nums">{brl(area.totalPrice)}</td>
                    <td className="px-3 py-2.5">
                      <ScorePill score={area.score} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={area.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
