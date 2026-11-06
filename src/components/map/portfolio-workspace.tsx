"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  Footprints,
  Check,
  Copy,
  Expand,
  Globe2,
  Layers,
  Mail,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Satellite,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { MapArea, BasemapId } from "@/lib/map-types";
import { BASEMAPS } from "@/lib/map-types";
import { CONTACT } from "@/lib/contact";
import { KIND_LABELS, STATUS_LABELS, brl, num } from "@/lib/format";
import { KindBadge, ScoreRing, StatusBadge, cn } from "@/components/ui";
import { PropertyImageryPanel } from "@/components/map/property-imagery";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas").then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#e7ebe2] text-xs text-muted">
      Carregando mapa interativo…
    </div>
  ),
});

const BASEMAP_ICONS = {
  mapa: MapIcon,
  satelite: Satellite,
  humanitario: Globe2,
} as const;

function shareText(area: MapArea, origin: string): string {
  return [
    `${area.name}`,
    `${area.code} · ${area.city}${area.neighborhood ? ` / ${area.neighborhood}` : ""}`,
    `Terreno: ${num(area.landAreaM2)} m²${area.builtAreaM2 ? ` · Construção: ${num(area.builtAreaM2)} m²` : ""}`,
    `Valor: ${brl(area.pricePerM2)}/m² · Total ${brl(area.totalPrice)}`,
    `Land Score: ${area.score}/100`,
    `Dossiê completo: ${origin}/apresentacao/${area.code}`,
  ].join("\n");
}

export function PortfolioWorkspace({
  areas,
  initialSelectedId = null,
  height = 520,
  showFilters = true,
  title = "Mapa do portfólio",
  subtitle = "Clique em um ponto para ver os dados do imóvel e do município.",
  cities = [],
}: {
  areas: MapArea[];
  initialSelectedId?: number | null;
  height?: number;
  showFilters?: boolean;
  title?: string;
  subtitle?: string;
  cities?: { slug: string; name: string }[];
}) {
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId);
  const [basemap, setBasemap] = useState<BasemapId>("mapa");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [city, setCity] = useState("todos");
  const [isFull, setIsFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [streetView, setStreetView] = useState(false);
  const [showRestrictionLayers, setShowRestrictionLayers] = useState(false);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [selectedContours, setSelectedContours] = useState<{ elevation: number; coordinates: [number, number][]; kind: string; inside?: boolean }[]>([]);
  const [selectedRestrictions, setSelectedRestrictions] = useState<{ id: number; type: string; label: string; coordinates: [number, number][]; areaM2?: number; lossPct?: number }[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return areas.filter((area) => {
      if (kind !== "todos" && area.kind !== kind) return false;
      if (status !== "todos" && area.status !== status) return false;
      if (city !== "todos" && area.city !== city) return false;
      if (!term) return true;
      return `${area.name} ${area.code} ${area.city} ${area.neighborhood} ${area.address}`
        .toLowerCase()
        .includes(term);
    });
  }, [areas, query, kind, status, city]);

  const visibleIds = useMemo(() => new Set(filtered.map((area) => area.id)), [filtered]);
  const selected = areas.find((area) => area.id === selectedId) ?? null;
  const mapAreas = useMemo(() => filtered.map((area) => ({ ...area, score: area.score })), [filtered]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setSelectedContours([]);
      setSelectedRestrictions([]);
      setOverlayLoading(false);
      return;
    }
    setOverlayLoading(true);
    Promise.all([
      fetch(`/api/areas/${selectedId}/terrain`, { cache: "no-store" }).then((response) => response.json()),
      fetch(`/api/areas/${selectedId}/restrictions`, { cache: "no-store" }).then((response) => response.json()),
    ]).then(([terrainData, restrictionData]) => {
      if (cancelled) return;
      setSelectedContours(terrainData?.ok ? (terrainData.analysis?.contours ?? []).filter((item: { inside?: boolean }) => item.inside !== false) : []);
      setSelectedRestrictions(restrictionData?.ok ? (restrictionData.restrictions ?? []) : []);
    }).catch((error) => {
      console.error("[portfolio-map:overlays]", error);
      if (!cancelled) {
        setSelectedContours([]);
        setSelectedRestrictions([]);
      }
    }).finally(() => {
      if (!cancelled) setOverlayLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const element = shellRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFull(false);
      } else {
        await element.requestFullscreen();
        setIsFull(true);
      }
    } catch {
      setIsFull((value) => !value);
    }
  }

  async function copyDossier() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(shareText(selected, window.location.origin));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  function openWhatsapp() {
    if (!selected) return;
    window.open(CONTACT.whatsapp(shareText(selected, window.location.origin)), "_blank", "noopener,noreferrer");
  }

  return (
    <div
      ref={shellRef}
      className={cn(
        "map-shell flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(11,30,24,0.05)]",
        isFull && "fixed inset-0 z-[1000] rounded-none",
      )}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-[#e9b7c1]">
              <MapIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-ink">{title}</p>
              <p className="hidden truncate text-[10px] text-muted sm:block">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-line bg-paper p-0.5">
              {(Object.keys(BASEMAPS) as BasemapId[]).map((key) => {
                const Icon = BASEMAP_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBasemap(key)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
                      basemap === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
                    )}
                    title={BASEMAPS[key].note}
                  >
                    <Icon className="h-3 w-3" />
                    {BASEMAPS[key].short}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowRestrictionLayers((value) => !value)}
              disabled={!selected || overlayLoading}
              aria-pressed={showRestrictionLayers}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                showRestrictionLayers ? "border-[#8c2f43] bg-[#8c2f43] text-white" : "border-line bg-white text-ink hover:border-[#8c2f43] hover:text-[#8c2f43]",
              )}
              title={overlayLoading ? "Carregando camadas do imóvel selecionado" : "Projetar curvas de nível e restrições do imóvel selecionado"}
            >
              <Layers className="h-3 w-3" /> {overlayLoading ? "Carregando..." : "Restrições"}
            </button>
            <button
              type="button"
              onClick={() => setStreetView(true)}
              disabled={!selected}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-medium text-ink transition hover:border-[#8c2f43] hover:text-[#8c2f43] disabled:cursor-not-allowed disabled:opacity-50"
              title={selected ? `Street View de ${selected.code}` : "Selecione um ativo no mapa"}
            >
              <Footprints className="h-3 w-3" /> Ver local
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 rounded-lg border border-forest bg-forest px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:bg-forest-600"
              title="Maximizar mapa para apresentação"
            >
              {isFull ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              <span className="hidden sm:inline">{isFull ? "Sair" : "Maximizar"}</span>
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper/60 px-3 py-2 sm:px-4">
            <div className="flex min-w-[160px] flex-1 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por código, nome, bairro ou cidade"
                className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-muted/70"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca">
                  <X className="h-3 w-3 text-muted" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted">
              <SlidersHorizontal className="h-3 w-3" />
              filtros
            </div>
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] text-ink outline-none"
            >
              <option value="todos">Todas as cidades</option>
              {(cities.length ? cities : [...new Set(areas.map((a) => ({ slug: a.city, name: a.city })))]).map((item) => (
                <option key={item.slug} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] text-ink outline-none"
            >
              <option value="todos">Todos os tipos</option>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] text-ink outline-none"
            >
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-ink-soft ring-1 ring-inset ring-line">
              {filtered.length} de {areas.length} ativos
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            "map-body grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_296px]",
            isFull ? "flex-1" : "",
          )}
          style={isFull ? undefined : { height }}
        >
          <div className="relative min-h-[300px]">
            <MapCanvas
              areas={mapAreas}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setShowRestrictionLayers(false);
              }}
              basemap={basemap}
              contours={showRestrictionLayers ? selectedContours : []}
              showContours={showRestrictionLayers}
              contourScope="inside"
              restrictions={showRestrictionLayers ? selectedRestrictions : []}
              fitToAreas
              className="h-full w-full"
            />
            <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-line bg-white/95 px-3 py-2 text-[10px] shadow-sm backdrop-blur">
              <p className="font-semibold uppercase tracking-[0.12em] text-muted">Legenda</p>
              <div className="mt-1.5 space-y-1">
                <p className="flex items-center gap-1.5 text-ink-soft">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8c2f43] text-[7px] font-bold text-white">T</span>
                  Terreno / gleba
                </p>
                <p className="flex items-center gap-1.5 text-ink-soft">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#1c5a6b] text-[7px] font-bold text-white">G</span>
                  Galpão / logística
                </p>
              </div>
              <p className="mt-2 max-w-[190px] text-[9px] leading-snug text-muted">
                {BASEMAPS[basemap].note}. Limites do perímetro são aproximados quando importados de KMZ.
              </p>
            </div>
            {!isFull ? (
              <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg border border-line bg-white/95 px-2.5 py-1.5 text-[10px] text-muted shadow-sm">
                {mapAreas.length} pontos visíveis
              </div>
            ) : null}
          </div>

          <aside className="hidden min-h-0 flex-col border-l border-line bg-white lg:flex">
            <div className="border-b border-line px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Ativos no mapa</p>
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-[11px] text-muted">Nenhum ativo com os filtros atuais.</p>
              ) : (
                filtered.map((area) => (
                  <div
                    key={area.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(area.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedId(area.id);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-2 border-b border-line/70 px-3 py-2.5 text-left transition hover:bg-paper/70",
                      selectedId === area.id && "bg-lime-soft/60",
                    )}
                  >
                    {area.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={area.coverUrl} alt="" className="h-11 w-14 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-paper text-[10px] text-muted">
                        sem foto
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">{area.code}</span>
                        <span className="rounded bg-forest px-1 py-0.5 text-[9px] font-semibold text-[#e9b7c1]">{area.score}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-ink">{area.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted">
                        {area.city} · {num(area.landAreaM2)} m²
                      </span>
                      <span className="flex items-center justify-between gap-1">
                        <span className="truncate text-[10px] font-semibold tabular-nums text-[#8c2f43]">
                          {brl(area.totalPrice, { compact: true })}
                        </span>
                        {area.listingUrl ? (
                          <a
                            href={area.listingUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="shrink-0 rounded bg-lime px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.06em] text-white hover:opacity-90"
                            title="Abrir o anúncio externo deste imóvel"
                          >
                            anúncio ↗
                          </a>
                        ) : null}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        {isFull ? (
          <div className="border-t border-line bg-white/95 px-4 py-2.5 backdrop-blur">
            {selected ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-paper px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                      {selected.code}
                    </span>
                    <StatusBadge status={selected.status} />
                    <KindBadge kind={selected.kind} />
                    <span className="rounded bg-forest px-1.5 py-0.5 text-[9px] font-semibold text-white">score {selected.score}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink">{selected.name}</p>
                  <p className="truncate text-[10px] text-muted">
                    {selected.city} · {num(selected.landAreaM2)} m² · {brl(selected.pricePerM2)}/m² · total{" "}
                    {brl(selected.totalPrice, { compact: true })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/areas/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white hover:bg-forest-600"
                  >
                    Acessar dossiê <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  {selected.listingUrl ? (
                    <a
                      href={selected.listingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-lime px-2.5 py-2 text-[11px] font-semibold text-white hover:opacity-90"
                      title="Abrir o anúncio externo deste imóvel"
                    >
                      <ExternalLink className="h-3 w-3" /> Anúncio
                    </a>
                  ) : null}
                  <Link
                    href={`/areas/${selected.id}/ficha`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-leaf"
                  >
                    Ficha PDF
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStreetView(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-[#8c2f43] hover:text-[#8c2f43]"
                  >
                    <Footprints className="h-3 w-3" /> Ver local
                  </button>
                  <button
                    type="button"
                    onClick={openWhatsapp}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-leaf"
                  >
                    WhatsApp
                  </button>
                  <Link
                    href={`/apresentacao/${selected.code}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-leaf"
                  >
                    Apresentação
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted">
                Clique em um ponto do mapa para abrir o ativo e acessar o dossiê completo.
              </p>
            )}
          </div>
        ) : null}

        {!isFull ? (
          <div className="border-t border-line bg-white">
            {selected ? (
              <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                {selected.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.coverUrl}
                    alt={selected.name}
                    className="h-24 w-full rounded-xl object-cover sm:h-20 sm:w-32"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-paper px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                      {selected.code}
                    </span>
                    <StatusBadge status={selected.status} />
                    <KindBadge kind={selected.kind} />
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-ink">{selected.name}</p>
                  <p className="truncate text-[11px] text-muted">
                    {selected.address || selected.city} · {num(selected.landAreaM2)} m²
                    {selected.builtAreaM2 > 0 ? ` · ${num(selected.builtAreaM2)} m² construídos` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-soft">
                    <span>
                      <strong className="font-semibold">{brl(selected.pricePerM2)}</strong>/m²
                    </span>
                    <span>
                      Valor total <strong className="font-semibold">{brl(selected.totalPrice, { compact: true })}</strong>
                    </span>
                    {selected.cityData ? (
                      <>
                        <span>
                          IBGE {num(selected.cityData.population2022)} hab
                        </span>
                        <span>renda {brl(selected.cityData.avgIncome)}</span>
                        <span>IDHM {selected.cityData.idhm.toFixed(3)}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <ScoreRing score={selected.score} size={66} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/areas/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-forest px-2.5 py-2 text-[11px] font-medium text-white hover:bg-forest-600"
                  >
                    Dossiê <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  {selected.listingUrl ? (
                    <a
                      href={selected.listingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-lime px-2.5 py-2 text-[11px] font-semibold text-white hover:opacity-90"
                      title="Abrir o anúncio externo deste imóvel"
                    >
                      <ExternalLink className="h-3 w-3" /> Anúncio
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={openWhatsapp}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreetView(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-[#8c2f43] hover:text-[#8c2f43]"
                  >
                    <Footprints className="h-3 w-3" /> Ver local
                  </button>
                  <Link
                    href={`/areas/${selected.id}#compartilhar`}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
                    title="Enviar por e-mail"
                  >
                    <Mail className="h-3 w-3" /> E-mail
                  </Link>
                  <button
                    type="button"
                    onClick={copyDossier}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[11px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
                  >
                    {copied ? <Check className="h-3 w-3 text-leaf" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-2 text-[11px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
                    title="Tela cheia"
                  >
                    <Expand className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-leaf" />
                  {visibleIds.size} ativos mapeados — selecione um ponto no mapa para abrir o resumo do imóvel e os
                  indicadores IBGE.
                </div>
                <Link href="/mapa" className="text-[11px] font-medium text-leaf-600 hover:underline">
                  Abrir mapa completo →
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {streetView && selected ? (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm"
          role="dialog"
          aria-label="Apresentação do local"
        >
          <div className="w-full max-w-3xl rounded-2xl border border-line bg-white p-3 shadow-2xl">
            <div className="flex items-start justify-between gap-2 pb-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Apresentação do local</p>
                <p className="text-sm font-semibold text-ink">
                  {selected.code} — {selected.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStreetView(false)}
                className="rounded-lg border border-line p-1.5 text-muted hover:border-[#8c2f43] hover:text-[#8c2f43]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PropertyImageryPanel
              lat={selected.lat}
              lng={selected.lng}
              geometry={selected.geometry.map((ring) => ring.coordinates)}
              coverUrl={selected.coverUrl}
              label={`${selected.code} — ${selected.city}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
