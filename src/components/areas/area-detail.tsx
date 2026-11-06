"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Images,
  Leaf,
  Map as MapIcon,
  Focus,
  Footprints,
  MapPin,
  Mountain,
  Pencil,
  Printer,
  Ruler,
  Satellite,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { AreaIntel } from "@/lib/intelligence";
import type { MapArea, BasemapId } from "@/lib/map-types";
import { BASEMAPS } from "@/lib/map-types";
import { KIND_LABELS, areaLabel, brl, dateLabel, num } from "@/lib/format";
import { Bar, Card, CityIndicators, Eyebrow, KindBadge, ScoreRing, StatusBadge, cn } from "@/components/ui";
import { MediaManager, type MediaItem } from "@/components/areas/media-manager";
import { TerrainPanel, type TerrainAnalysis } from "@/components/areas/terrain-panel";
import { RestrictionsPanel, type RestrictionItem } from "@/components/areas/restrictions-panel";
import { FieldHelp } from "@/components/ui/field-help";
import { RestrictionOverview } from "@/components/areas/restriction-overview";
import { PropertyImageryPanel } from "@/components/map/property-imagery";
import { ReferenceDistances } from "@/components/areas/reference-distances";
import { streetViewLinks } from "@/lib/streetview";
import type { TerrainHeatmap } from "@/db/schema";
import { SharePanel } from "@/components/areas/share-panel";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas").then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#e7ebe2] text-xs text-muted">Carregando mapa…</div>,
});

const ICONS = { mapa: MapIcon, satelite: Satellite, humanitario: Globe2 } as const;

export type DetailArea = MapArea & {
  description: string;
  zoningNotes: string;
  environmentalNotes: string;
  ownerName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  kmzFileName: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  featured: boolean;
  zipCode: string;
  citySlug: string;
  transaction: string;
  partnerName: string;
  partnerPhone: string;
  listingUrl: string;
};

type Tab = "visao" | "mapa" | "documentos" | "inteligencia" | "ibge";

const TABS: { id: Tab; label: string }[] = [
  { id: "visao", label: "Visão geral" },
  { id: "mapa", label: "Mapa & perímetro" },
  { id: "documentos", label: "Documentos & fotos" },
  { id: "inteligencia", label: "Inteligência" },
  { id: "ibge", label: "IBGE & região" },
];

export function AreaDetail({
  area,
  intel,
  media,
  activities,
  initialTerrain,
  initialRestrictions = [],
  navigation,
}: {
  area: DetailArea;
  intel: AreaIntel;
  media: MediaItem[];
  activities: { id: number; type: string; title: string; detail: string; createdAt: string | Date }[];
  initialTerrain?: TerrainAnalysis | null;
  initialRestrictions?: RestrictionItem[];
  navigation?: {
    previous: { id: number; code: string; name: string } | null;
    next: { id: number; code: string; name: string } | null;
    position: number;
    total: number;
  };
}) {
  const [tab, setTab] = useState<Tab>("visao");
  const [basemap, setBasemap] = useState<BasemapId>("satelite");
  const [contours, setContours] = useState<TerrainAnalysis["contours"]>(initialTerrain?.contours ?? []);
  const [heatmap, setHeatmap] = useState<TerrainHeatmap | null>(initialTerrain?.heatmap ?? null);
  const [cutFillHeatmap, setCutFillHeatmap] = useState<TerrainHeatmap | null>(initialTerrain?.cutFillHeatmap ?? null);
  const [contourScope, setContourScope] = useState<"both" | "inside" | "around">(
    initialTerrain?.scope === "around" || initialTerrain?.scope === "both" ? initialTerrain.scope : "inside",
  );
  const [heatmapMode, setHeatmapMode] = useState<"elevation" | "cutfill">("elevation");
  const [heatmapScope, setHeatmapScope] = useState<"both" | "inside" | "around">("inside");
  const [heatmapOpacity, setHeatmapOpacity] = useState(60);
  const [fitSignal, setFitSignal] = useState(0);
  const [restrictions, setRestrictions] = useState<RestrictionItem[]>(initialRestrictions);
  const [mapView, setMapView] = useState({ lat: area.lat, lng: area.lng, zoom: 16 });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const photos = media.filter((item) => item.kind === "photo");
  const [activePhoto, setActivePhoto] = useState(0);
  const cover = photos[activePhoto]?.url ?? area.coverUrl;
  const occupancy = area.landAreaM2 > 0 ? (area.builtAreaM2 / area.landAreaM2) * 100 : 0;

  function persistMapView(override?: Partial<typeof mapView> & Record<string, unknown>) {
    const next = { ...mapView, ...override };
    setMapView({ lat: next.lat, lng: next.lng, zoom: next.zoom });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch(`/api/areas/${area.id}/map-view`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: next.lat,
          lng: next.lng,
          zoom: next.zoom,
          basemap,
          contourScope,
          heatmapMode,
          heatmapScope,
          heatmapOpacity,
          contours: contours.length > 0,
          heatmap: Boolean(heatmap),
        }),
      }).catch(() => undefined);
    }, 500);
  }

  return (
    <div className="space-y-5">
      {area.status === "vendido" || area.status === "cancelado" ? (
        <div className="rounded-xl border border-[#e3c2c9] bg-[#f6e8eb]/60 px-3 py-2 text-[11px] text-[#8c2f43]">
          <strong>Ativo encerrado ({area.status === "vendido" ? "vendido" : "cancelado"}).</strong> Este imóvel está fora do
          controle operacional e não aparece no portfólio, mapa, indicadores ou relatórios. Disponível apenas para
          consulta histórica.
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={area.status === "vendido" || area.status === "cancelado" ? "/consultas" : "/areas"} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {area.status === "vendido" || area.status === "cancelado" ? "Voltar às consultas" : "Todas as áreas"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {navigation ? (
            <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-0.5">
              <Link
                href={navigation.previous ? `/areas/${navigation.previous.id}` : "#"}
                aria-disabled={!navigation.previous}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[11px] font-medium",
                  navigation.previous ? "text-ink hover:bg-paper" : "cursor-not-allowed text-muted/50",
                )}
                title={navigation.previous ? `Anterior: ${navigation.previous.code}` : "Primeiro ativo"}
              >
                ← Anterior
              </Link>
              <span className="px-1 text-[9px] tabular-nums text-muted">
                {navigation.position}/{navigation.total}
              </span>
              <Link
                href={navigation.next ? `/areas/${navigation.next.id}` : "#"}
                aria-disabled={!navigation.next}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[11px] font-medium",
                  navigation.next ? "bg-forest text-white hover:bg-forest-600" : "cursor-not-allowed text-muted/50",
                )}
                title={navigation.next ? `Próximo: ${navigation.next.code}` : "Último ativo"}
              >
                Próximo →
              </Link>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setTab("mapa");
              setTimeout(() => document.getElementById("mapa-perimetro")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#8c2f43]/30 bg-[#f6e8eb] px-3 py-2 text-[11px] font-medium text-[#8c2f43] hover:border-[#8c2f43]"
          >
            <Mountain className="h-3 w-3" /> Curvas de nível
          </button>
          <Link
            href={`/areas/${area.id}/editar`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-medium hover:border-leaf hover:text-leaf-600"
          >
            <Pencil className="h-3 w-3" /> Editar cadastro
          </Link>
          <a
            href={streetViewLinks(area.lat, area.lng).pano}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[11px] font-medium text-ink hover:border-[#8c2f43] hover:text-[#8c2f43]"
            title="Abrir o Google Street View na coordenada do imóvel"
          >
            <Footprints className="h-3 w-3" /> Ver local
          </a>
          <Link
            href={`/areas/${area.id}/ficha`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8c2f43] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#7a2739]"
          >
            <Printer className="h-3 w-3" /> Exportar ficha (PDF)
          </Link>
          <Link
            href={`/apresentacao/${area.code}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-medium text-white hover:bg-forest-600"
          >
            <ExternalLink className="h-3 w-3 text-[#e9b7c1]" /> Abrir apresentação
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-forest px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#e9b7c1]">{area.code}</span>
            <StatusBadge status={area.status} />
            <KindBadge kind={area.kind} />
            {area.featured ? (
              <span className="rounded-full border border-leaf/30 bg-leaf-50 px-2 py-1 text-[10px] font-medium text-leaf-600">destaque</span>
            ) : null}
            {area.environmentalRestriction ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
                <ShieldAlert className="h-3 w-3" /> restrição ambiental
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{area.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {[area.address, area.neighborhood, area.city, "SP"].filter(Boolean).join(" · ")}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> atualizado em {dateLabel(area.updatedAt)}
            </span>
            <span className="tabular-nums">
              {area.lat.toFixed(5)}, {area.lng.toFixed(5)}
            </span>
            {area.kmzFileName ? (
              <span className="inline-flex items-center gap-1 text-leaf-600">
                <FileText className="h-3 w-3" /> {area.kmzFileName}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5">
          <ScoreRing score={intel.score} size={62} />
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Land Score</p>
            <p className="text-sm font-semibold text-ink">{intel.grade}</p>
            <p className="text-[10px] text-muted">
              {intel.marketDeltaPct >= 0 ? "+" : ""}
              {intel.benchmark > 0 ? `${num(intel.marketDeltaPct)}% vs. benchmark` : "Benchmark pendente de aferição"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_352px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-white p-1">
            <Link
              href="/documentacao"
              className="ml-auto rounded-md px-2 py-1.5 text-[10px] font-medium text-muted hover:bg-paper hover:text-leaf-600"
              title="Manual da ferramenta"
            >
              manual
            </Link>
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "rounded-lg px-3 py-2 text-[11px] font-medium transition",
                  tab === item.id ? "bg-forest text-white" : "text-muted hover:bg-paper hover:text-ink",
                )}
              >
                {item.label}
                {item.id === "documentos" ? (
                  <span className={cn("ml-1 rounded px-1 text-[9px]", tab === item.id ? "bg-white/20" : "bg-paper-deep text-ink-soft")}>
                    {media.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {tab === "visao" ? (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="relative h-64 bg-paper-deep sm:h-80">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt={area.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-muted">
                      <Images className="h-6 w-6" />
                      <p className="text-xs">Nenhuma foto cadastrada — envie imagens na aba Documentos.</p>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 rounded-full bg-forest/85 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">
                    {area.photoCount} foto(s) no dossiê
                  </div>
                </div>
                {photos.length > 1 ? (
                  <div className="flex gap-1.5 overflow-x-auto p-2">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setActivePhoto(index)}
                        className={cn(
                          "h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 transition",
                          index === activePhoto ? "border-leaf" : "border-transparent opacity-70 hover:opacity-100",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </Card>

              <Card className="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Área do terreno", value: `${num(area.landAreaM2)} m²`, hint: areaLabel(area.landAreaM2), icon: Ruler },
                    { label: "Área construída", value: area.builtAreaM2 > 0 ? `${num(area.builtAreaM2)} m²` : "—", hint: `${num(occupancy)}% do terreno`, icon: Building2 },
                    { label: "Valor por m²", value: brl(area.pricePerM2), hint: `solo equiv. ${brl(intel.landEquivalentPrice)}`, icon: Wallet },
                    { label: "Valor total", value: brl(area.totalPrice), hint: `${brl(intel.pricePerHa)}/hectare`, icon: TrendingUp },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="rounded-xl border border-line bg-paper/50 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">{item.label}</p>
                          <Icon className="h-3 w-3 text-muted" />
                        </div>
                        <p className="mt-1.5 text-base font-semibold tabular-nums">{item.value}</p>
                        <p className="text-[10px] text-muted">{item.hint}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <Eyebrow>Descrição do imóvel</Eyebrow>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                    {area.description || "Descrição não informada. Edite o cadastro para incluir a narrativa comercial do ativo."}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-line p-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Zoneamento</p>
                    <p className="mt-1 text-sm font-medium text-ink">{area.zoning || "Não informado"}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{area.zoningNotes || "Sem observações adicionais."}</p>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl border p-3",
                      area.environmentalRestriction ? "border-amber-200 bg-amber-50/60" : "border-line bg-leaf-50/40",
                    )}
                  >
                    <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {area.environmentalRestriction ? <AlertTriangle className="h-3 w-3 text-amber-600" /> : <Leaf className="h-3 w-3 text-leaf" />}
                      Restrição ambiental
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {area.environmentalRestriction ? "Restrição declarada" : "Sem restrição mapeada"}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">
                      {area.environmentalNotes || "Nenhuma restrição ambiental registrada no cadastro."}
                    </p>
                  </div>
                </div>

                {initialTerrain?.stats ? (
                  <div className="mt-4 rounded-xl border border-[#e3c2c9] bg-[#f6e8eb]/25 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Mountain className="h-3.5 w-3.5 text-[#8c2f43]" />
                        <p className="text-xs font-semibold text-ink">Terreno &amp; terraplenagem</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab("mapa")}
                        className="rounded-lg border border-[#8c2f43]/30 bg-white px-2 py-1 text-[10px] font-medium text-[#8c2f43] hover:border-[#8c2f43]"
                      >
                        Abrir curvas de nível e mapa de calor
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "Cotas", value: `${num(initialTerrain.stats.minElevation)}–${num(initialTerrain.stats.maxElevation)} m` },
                        { label: "Declividade média", value: `${num(initialTerrain.stats.slopePct, 2)}%` },
                        {
                          label: "Corte / aterro",
                          value: initialTerrain.grading
                            ? `${num(initialTerrain.grading.cutVolumeM3)} / ${num(initialTerrain.grading.fillVolumeM3)} m³`
                            : "—",
                        },
                        {
                          label: "Custo terraplenagem",
                          value: initialTerrain.grading ? brl(initialTerrain.grading.totalCost, { compact: true }) : "—",
                        },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-white/80 px-2 py-1.5">
                          <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p>
                          <p className="text-[11px] font-semibold tabular-nums text-ink">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[9px] text-muted">
                      {initialTerrain.grading
                        ? `Cota de projeto ${num(initialTerrain.grading.targetElevation, 2)} m · ${brl(initialTerrain.grading.costPerM2)}/m² · prazo estimado ${initialTerrain.grading.days} dias · parecer detalhado na aba Mapa.`
                        : "Análise de curvas de nível disponível na aba Mapa."}
                    </p>
                  </div>
                ) : null}

                {restrictions.length ? (
                  <div className="mt-4 rounded-xl border border-[#e3c2c9] bg-[#f6e8eb]/25 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Ban className="h-3.5 w-3.5 text-[#8c2f43]" />
                        <p className="text-xs font-semibold text-ink">Restrições e perda de área</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab("mapa")}
                        className="rounded-lg border border-[#8c2f43]/30 bg-white px-2 py-1 text-[10px] font-medium text-[#8c2f43] hover:border-[#8c2f43]"
                      >
                        Ver demarcações no mapa
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(() => {
                        const restricted = restrictions.reduce((sum, item) => sum + item.areaM2, 0);
                        const lossPct = restrictions.reduce((sum, item) => sum + item.lossPct, 0);
                        return [
                          { label: "Demarcações", value: String(restrictions.length) },
                          { label: "Área restrita", value: areaLabel(restricted) },
                          { label: "Perda sobre o total", value: `${num(lossPct, 2)}%` },
                          { label: "Área aproveitável", value: areaLabel(Math.max(0, area.landAreaM2 - restricted)) },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg bg-white/80 px-2 py-1.5">
                            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p>
                            <p className="text-[11px] font-semibold tabular-nums text-[#8c2f43]">{item.value}</p>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="mt-2">
                      <RestrictionOverview
                        geometry={area.geometry.map((ring) => ring.coordinates)}
                        restrictions={restrictions}
                        totalAreaM2={area.landAreaM2}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2 border-t border-line pt-3 text-[11px] sm:grid-cols-2">
                  <p className="text-muted">
                    Proprietário: <strong className="text-ink-soft">{area.ownerName || "—"}</strong>
                  </p>
                  <p className="text-muted">
                    Contato: <strong className="text-ink-soft">{area.contactName || "—"}</strong>
                    {area.contactPhone ? ` · ${area.contactPhone}` : ""}
                  </p>
                  <p className="text-muted">
                    CEP: <strong className="text-ink-soft">{area.zipCode || "—"}</strong>
                  </p>
                  <p className="text-muted">
                    Fotos / documentos: <strong className="text-ink-soft">{area.photoCount} / {area.documentCount}</strong>
                  </p>
                  <p className="text-muted">
                    Transação: <strong className="text-ink-soft">{area.transaction === "locacao" ? "Locação" : "Venda"}</strong>
                  </p>
                  <p className="text-muted">
                    Parceiro corretor: <strong className="text-ink-soft">{area.partnerName || "—"}</strong>
                    {area.partnerPhone ? ` · ${area.partnerPhone}` : ""}
                  </p>
                  <p className="text-muted sm:col-span-2">
                    Link do anúncio:{" "}
                    {area.listingUrl ? (
                      <strong className="text-ink-soft">
                        {area.listingUrl.replace(/^https?:\/\//, "").slice(0, 60)}
                      </strong>
                    ) : (
                      <strong className="text-ink-soft">não informado</strong>
                    )}
                  </p>
                </div>

                {/* Link do anúncio — destaque no quadro de informações do imóvel */}
                {area.listingUrl ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-leaf/30 bg-leaf-50/60 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-leaf-600">
                        Anúncio externo
                      </p>
                      <p className="truncate text-[11px] text-ink-soft">{area.listingUrl}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <a
                        href={area.listingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white hover:bg-forest-600"
                      >
                        <ExternalLink className="h-3 w-3 text-lime" /> Abrir anúncio
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(area.listingUrl);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[10px] font-medium text-ink-soft hover:border-leaf hover:text-leaf-600"
                        title="Copiar link do anúncio"
                      >
                        <Copy className="h-3 w-3" /> copiar
                      </button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>
          ) : null}

          {tab === "mapa" ? (
            <Card className="overflow-hidden" id="mapa-perimetro">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                <p className="flex items-center gap-1 text-xs font-semibold">
                  Localização e perímetro importado <FieldHelp helpKey="mapa.basemap" label="Camadas do mapa" />
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFitSignal((value) => value + 1)}
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[10px] font-medium text-ink-soft hover:border-leaf hover:text-leaf-600"
                    title="Centralizar e aproximar na área do KMZ"
                  >
                    <Focus className="h-3 w-3" /> Centralizar no KMZ
                  </button>

                  <div className="flex items-center rounded-md border border-line bg-paper p-0.5">
                    {(Object.keys(BASEMAPS) as BasemapId[]).map((key) => {
                      const Icon = ICONS[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                          setBasemap(key);
                          persistMapView({ basemap: key });
                        }}
                          className={cn(
                            "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium",
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
                </div>
              </div>
              <div className="h-[440px]">
                <MapCanvas
                  areas={[area]}
                  selectedId={area.id}
                  basemap={basemap}
                  fitToAreas
                  showPopup={false}
                  contours={contours}
                  contourScope={contourScope}
                  elevationRange={
                    initialTerrain?.stats
                      ? { min: initialTerrain.stats.minElevation, max: initialTerrain.stats.maxElevation }
                      : null
                  }
                  heatmap={heatmap}
                  cutFillHeatmap={cutFillHeatmap}
                  heatmapMode={heatmapMode}
                  heatmapScope={heatmapScope}
                  heatmapOpacity={heatmapOpacity}
                  fitSignal={fitSignal}
                  restrictions={restrictions.map((item) => ({
                    id: item.id,
                    type: item.type,
                    label: item.label,
                    coordinates: item.coordinates,
                    areaM2: item.areaM2,
                    lossPct: item.lossPct,
                  }))}
                  onMove={(view) => persistMapView(view)}
                  initialZoom={16}
                  className="h-full w-full"
                />
              </div>
              <div className="border-t border-line p-3">
                <ReferenceDistances lat={area.lat} lng={area.lng} title="Distâncias do imóvel" />
              </div>
              <div className="border-t border-line p-3">
                <PropertyImageryPanel
                  lat={area.lat}
                  lng={area.lng}
                  geometry={area.geometry.map((ring) => ring.coordinates)}
                  coverUrl={area.coverUrl}
                  photoUrls={photos.map((photo) => photo.url)}
                  label={`${area.code} — ${area.name}`}
                />
              </div>
              <div className="border-t border-line p-3">
                <RestrictionsPanel
                  areaId={area.id}
                  totalAreaM2={area.landAreaM2}
                  geometry={area.geometry.map((ring) => ring.coordinates)}
                  initial={restrictions}
                  onChange={setRestrictions}
                />
              </div>
              <div className="border-t border-line p-3">
                <TerrainPanel
                  areaId={area.id}
                  onViewChange={(view) => {
                    setContours(view.contours);
                    setHeatmap(view.heatmap);
                    setCutFillHeatmap(view.cutFillHeatmap);
                    setContourScope(view.contourScope);
                    setHeatmapMode(view.heatmapMode);
                    setHeatmapScope(view.heatmapScope);
                    setHeatmapOpacity(view.heatmapOpacity);
                    persistMapView({
                      contourScope: view.contourScope,
                      heatmapMode: view.heatmapMode,
                      heatmapScope: view.heatmapScope,
                      heatmapOpacity: view.heatmapOpacity,
                      contours: view.contours.length > 0,
                      heatmap: Boolean(view.heatmap),
                    });
                  }}
                />
              </div>
              <div className="grid gap-2 border-t border-line p-3 text-[11px] sm:grid-cols-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-muted">Coordenadas</p>
                  <p className="font-medium tabular-nums">{area.lat.toFixed(5)}, {area.lng.toFixed(5)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-muted">Perímetro</p>
                  <p className="font-medium">{area.geometry.length} polígono(s) · {area.kmzFileName ?? "sem arquivo KMZ"}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.1em] text-muted">Distâncias</p>
                  <p className="font-medium">
                    Viracopos {num(intel.distances.viracopos, 1)} km · Campinas {num(intel.distances.campinas, 1)} km
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {tab === "documentos" ? (
            <Card className="p-4 sm:p-5">
              <Eyebrow>Dossiê digital</Eyebrow>
              <h2 className="mt-1 flex items-center gap-1 text-base font-semibold">
                Documentos, plantas, matrículas e fotos <FieldHelp helpKey="mapa.docs" label="Documentos e fotos" />
              </h2>
              <p className="mt-1 text-[11px] text-muted">
                Arquivos armazenados com segurança no banco de dados do CRM e disponíveis na apresentação pública.
              </p>
              <div className="mt-4">
                <MediaManager areaId={area.id} media={media} />
              </div>
            </Card>
          ) : null}

          {tab === "inteligencia" ? (
            <div className="space-y-4">
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Eyebrow>Motor de inteligência Land Bank</Eyebrow>
                    <h2 className="mt-1 text-base font-semibold">Como este ativo pontua</h2>
                    <p className="mt-1 max-w-xl text-[11px] text-muted">
                      Modelo proprietário combina mercado local (IBGE), logística, preço versus benchmark, aproveitamento
                      do solo, risco ambiental/zoneamento e completude do dossiê.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScoreRing score={intel.score} size={72} />
                    <div className="text-[11px]">
                      <p className="font-semibold text-ink">{intel.grade}</p>
                      <p className="text-muted">{intel.benchmark > 0 ? `benchmark ${brl(intel.benchmark)}/m²` : "benchmark pendente de comparáveis auditáveis"}</p>
                      <p className="text-muted">hub mais próximo: {intel.bestHub} ({num(intel.bestHubKm, 1)} km)</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {intel.pillars.map((pillar) => (
                    <div key={pillar.key}>
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[11px] font-medium text-ink">
                          {pillar.label}
                          <span className="ml-1 text-[9px] text-muted">peso {Math.round(pillar.weight * 100)}%</span>
                        </p>
                        <p className="text-[11px] font-semibold tabular-nums">{pillar.score}</p>
                      </div>
                      <div className="mt-1">
                        <Bar value={pillar.score} max={100} tone={pillar.score >= 70 ? "leaf" : pillar.score >= 55 ? "amber" : "amber"} />
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted">{pillar.note}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-leaf" />
                    <h3 className="flex items-center gap-1 text-sm font-semibold">
                      Leituras do ativo <FieldHelp helpKey="inteligencia.score" label="Land Score" />
                    </h3>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {intel.insights.map((insight) => (
                      <li key={insight} className="flex gap-1.5 text-[11px] leading-relaxed text-ink-soft">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-leaf" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold">Pendências e riscos</h3>
                  </div>
                  {intel.alerts.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {intel.alerts.map((alert) => (
                        <li key={alert} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
                          {alert}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 rounded-lg bg-leaf-50 px-2.5 py-2 text-[11px] text-leaf-600">
                      Dossiê completo, sem pendências identificadas.
                    </p>
                  )}
                  <div className="mt-3 space-y-1 border-t border-line pt-2 text-[10px] text-muted">
                    <p>Distância de Viracopos: {num(intel.distances.viracopos, 1)} km</p>
                    <p>Distância de Campinas: {num(intel.distances.campinas, 1)} km</p>
                    <p>Distância de Piracicaba: {num(intel.distances.piracicaba, 1)} km</p>
                  </div>
                </Card>
              </div>
            </div>
          ) : null}

          {tab === "ibge" ? (
            <Card className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-leaf" />
                <div>
                  <Eyebrow>Indicadores oficiais</Eyebrow>
                  <h2 className="text-base font-semibold">{area.cityData?.name ?? area.city} — dados IBGE</h2>
                </div>
              </div>
              {area.cityData ? (
                <div className="mt-4">
                  <CityIndicators city={area.cityData} point={{ lat: area.lat, lng: area.lng }} />
                  <Link href="/indicadores" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-leaf-600 hover:underline">
                    Comparar com outros municípios <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">Município sem base IBGE vinculada. Edite o cadastro para selecionar a cidade.</p>
              )}
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <Eyebrow>Preço pedido</Eyebrow>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{brl(area.pricePerM2)}<span className="text-sm font-normal text-muted">/m²</span></p>
            <p className="text-xs text-muted">Valor total {brl(area.totalPrice)}</p>
            <div className="mt-3 space-y-1.5 border-t border-line pt-2.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted">Benchmark {area.city}</span>
                <span className="font-semibold">{intel.benchmark > 0 ? `${brl(intel.benchmark)}/m²` : "Pendente de aferição"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Diferença</span>
                <span className={cn("font-semibold", intel.marketDeltaPct <= 0 ? "text-leaf-600" : "text-amber-700")}>
                  {intel.marketDeltaPct >= 0 ? "+" : ""}
                  {num(intel.marketDeltaPct)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Valor por hectare</span>
                <span className="font-semibold">{brl(intel.pricePerHa)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Tipo</span>
                <span className="font-semibold">{KIND_LABELS[area.kind]}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4" id="compartilhar">
            <SharePanel areaId={area.id} />
          </Card>

          {area.cityData ? (
            <Card className="p-4">
              <Eyebrow>IBGE · {area.cityData.name}</Eyebrow>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { label: "População 2022", value: num(area.cityData.population2022) },
                  { label: "Renda média", value: brl(area.cityData.avgIncome) },
                  {
                    label: "Salário formal",
                    value:
                      (area.cityData.formalMinWages ?? 0) > 0
                        ? `${num(area.cityData.formalMinWages ?? 0, 2)} sal. mín.`
                        : "—",
                  },
                  { label: "IDHM", value: area.cityData.idhm.toFixed(3) },
                  { label: "PIB per capita", value: brl(area.cityData.gdpPerCapita) },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-paper/70 px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-[0.08em] text-muted">{item.label}</p>
                    <p className="text-[11px] font-semibold tabular-nums text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">{area.cityData.topSectors}</p>
              <button
                type="button"
                onClick={() => setTab("ibge")}
                className="mt-2 w-full rounded-lg border border-line py-1.5 text-[10px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
              >
                Ver painel IBGE completo
              </button>
            </Card>
          ) : null}

          <Card className="p-4">
            <details>
              <summary className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Histórico do ativo</span>
                <span className="rounded bg-paper px-1.5 py-0.5 text-[9px] font-semibold text-ink-soft">
                  {activities.length}
                </span>
              </summary>
              <ol className="mt-3 space-y-2.5">
              {activities.length === 0 ? (
                <li className="text-[11px] text-muted">Nenhuma atividade registrada.</li>
              ) : (
                activities.map((activity) => (
                  <li key={activity.id} className="border-l-2 border-leaf/30 pl-2.5">
                    <p className="text-[11px] font-medium text-ink">{activity.title}</p>
                    <p className="text-[10px] leading-snug text-muted">{activity.detail}</p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-muted/70">{dateLabel(activity.createdAt)}</p>
                  </li>
                ))
              )}
              </ol>
            </details>
          </Card>
        </aside>
      </div>
    </div>
  );
}
