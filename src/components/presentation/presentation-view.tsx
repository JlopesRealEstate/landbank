"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Building2,
  Check,
  Copy,
  Database,
  Download,
  FileText,
  Globe2,
  Leaf,
  Mail,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Ruler,
  Satellite,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import type { City } from "@/db/schema";
import { BASEMAPS, type BasemapId, type MapArea } from "@/lib/map-types";
import { ALQUEIRE_PAULISTA_M2, areaLabel, brl, num } from "@/lib/format";
import { CONTACT } from "@/lib/contact";
import { BrandMark, Card, CityIndicators, KindBadge, StatusBadge, cn } from "@/components/ui";
import type { AreaIntel } from "@/lib/intelligence";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas").then((mod) => mod.MapCanvas), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#e7ebe2] text-xs text-muted">Carregando mapa…</div>,
});

const ICONS = { mapa: MapIcon, satelite: Satellite, humanitario: Globe2 } as const;

export type PresentationMedia = {
  id: number;
  kind: string;
  category: string;
  name: string;
  size: number;
  url: string;
};

export function PresentationView({
  area,
  intel,
  city,
  media,
  contours = [],
  elevationRange = null,
}: {
  area: MapArea & { description: string; zoningNotes: string; environmentalNotes: string; contactName: string; contactPhone: string; contactEmail: string };
  intel: AreaIntel;
  city?: City;
  media: PresentationMedia[];
  contours?: { elevation: number; coordinates: [number, number][]; kind: string; inside?: boolean }[];
  elevationRange?: { min: number; max: number } | null;
}) {
  const photos = media.filter((item) => item.kind === "photo");
  const documents = media.filter((item) => item.kind === "document");
  const [active, setActive] = useState(0);
  const [basemap, setBasemap] = useState<BasemapId>("satelite");
  const [fitSignal, setFitSignal] = useState(0);
  const [copied, setCopied] = useState(false);
  const cover = photos[active]?.url ?? area.coverUrl;

  const shareText = [
    `${area.name}`,
    `${area.code} · ${area.city} — ${area.neighborhood}`,
    `${num(area.landAreaM2)} m² de terreno${area.builtAreaM2 ? ` · ${num(area.builtAreaM2)} m² construídos` : ""}`,
    `${brl(area.pricePerM2)}/m² · ${brl(area.totalPrice)}`,
    typeof window !== "undefined" ? window.location.href : "",
  ]
    .filter(Boolean)
    .join("\n");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink">Land Bank Corp</p>
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Áreas &amp; Galpões · apresentação</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-paper px-2.5 py-1 text-[10px] text-muted sm:block">
              Sumaré · RMC · Piracicaba
            </span>
            <a
              href={CONTACT.whatsapp(shareText)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white hover:bg-forest-600"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#e9b7c1]" /> Falar com o time
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        {area.status === "vendido" || area.status === "cancelado" ? (
          <div className="rounded-xl border border-[#e3c2c9] bg-[#f6e8eb]/70 px-3 py-2 text-[11px] text-[#8c2f43]">
            <strong>Ativo histórico:</strong> este imóvel está {area.status === "vendido" ? "vendido" : "cancelado"} e fora
            do portfólio ativo da Land Bank Corp. Apresentação mantida apenas para consulta.
          </div>
        ) : null}
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="relative h-[280px] bg-paper-deep sm:h-[400px]">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt={area.name} className="h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-forest/90 via-forest/25 to-forest/10" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-lime px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-forest">{area.code}</span>
                <StatusBadge status={area.status} />
                <KindBadge kind={area.kind} />
                {area.environmentalRestriction ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800">
                    <ShieldAlert className="h-3 w-3" /> restrição ambiental
                  </span>
                ) : null}
              </div>
              <h1 className="mt-2 max-w-3xl text-xl font-semibold leading-tight text-white sm:text-3xl">{area.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/75">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {[area.address, area.neighborhood, area.city, "SP"].filter(Boolean).join(" · ")}
                </span>
                <span>
                  {num(area.landAreaM2)} m² · {num(area.landAreaM2 / ALQUEIRE_PAULISTA_M2, 2)} alq · {num(area.landAreaM2 / 10_000, 2)} ha
                </span>
                {area.builtAreaM2 > 0 ? <span>{num(area.builtAreaM2)} m² construídos</span> : null}
                <span className="rounded bg-lime px-1.5 py-0.5 font-semibold text-white">
                  {brl(area.totalPrice)}
                </span>
              </p>
            </div>
          </div>

          {photos.length > 1 ? (
            <div className="flex gap-1.5 overflow-x-auto p-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setActive(index)}
                  className={cn(
                    "h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition",
                    index === active ? "border-leaf" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Área do terreno", value: `${num(area.landAreaM2)} m²`, hint: `${num(area.landAreaM2 / ALQUEIRE_PAULISTA_M2, 2)} alq · ${num(area.landAreaM2 / 10_000, 2)} ha`, icon: Ruler },
            { label: "Área construída", value: area.builtAreaM2 > 0 ? `${num(area.builtAreaM2)} m²` : "—", hint: area.builtAreaM2 > 0 ? "galpão / benfeitorias" : "terreno sem construção", icon: Building2 },
            { label: "Valor por m²", value: brl(area.pricePerM2), hint: "condição comercial", icon: Wallet },
            { label: "Valor total", value: brl(area.totalPrice), hint: `hectare ${brl(intel.pricePerHa)}`, icon: ArrowUpRight },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                  <Icon className="h-3.5 w-3.5 text-leaf" />
                </div>
                <p className="mt-1.5 text-base font-semibold tabular-nums">{item.value}</p>
                <p className="text-[10px] text-muted">{item.hint}</p>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Card className="p-4 sm:p-5">
              <h2 className="text-base font-semibold">Sobre o imóvel</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {area.description || "Descrição comercial em atualização."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line p-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Zoneamento</p>
                  <p className="mt-1 text-sm font-medium">{area.zoning || "A informar"}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{area.zoningNotes || "Sem observações."}</p>
                </div>
                <div className={cn("rounded-xl border p-3", area.environmentalRestriction ? "border-amber-200 bg-amber-50/60" : "border-line bg-leaf-50/40")}>
                  <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {area.environmentalRestriction ? <ShieldAlert className="h-3 w-3 text-amber-600" /> : <Leaf className="h-3 w-3 text-leaf" />}
                    Restrição ambiental
                  </p>
                  <p className="mt-1 text-sm font-medium">{area.environmentalRestriction ? "Restrição declarada" : "Sem restrição mapeada"}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{area.environmentalNotes || "Nenhuma restrição registrada."}</p>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                <h2 className="text-sm font-semibold">Localização e perímetro</h2>
                <div className="flex items-center rounded-md border border-line bg-paper p-0.5">
                  <button
                    type="button"
                    onClick={() => setFitSignal((value) => value + 1)}
                    className="mr-1 rounded px-2 py-1 text-[10px] font-medium text-ink-soft hover:bg-white"
                    title="Centralizar no KMZ"
                  >
                    centralizar
                  </button>
                  {(Object.keys(BASEMAPS) as BasemapId[]).map((key) => {
                    const Icon = ICONS[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBasemap(key)}
                        className={cn(
                          "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium",
                          basemap === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
                        )}
                      >
                        <Icon className="h-3 w-3" /> {BASEMAPS[key].short}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="h-[380px]">
                <MapCanvas
                  areas={[area]}
                  selectedId={area.id}
                  basemap={basemap}
                  fitToAreas
                  showPopup={false}
                  contours={contours.filter((contour) => contour.inside !== false)}
                  elevationRange={elevationRange}
                  heatmap={null}
                  fitSignal={fitSignal}
                  className="h-full w-full"
                />
              </div>
              <div className="grid gap-2 border-t border-line p-3 text-[10px] sm:grid-cols-3">
                <p className="text-muted">
                  Coordenadas <strong className="block text-[11px] text-ink-soft">{area.lat.toFixed(5)}, {area.lng.toFixed(5)}</strong>
                </p>
                <p className="text-muted">
                  Distância de Viracopos <strong className="block text-[11px] text-ink-soft">{num(intel.distances.viracopos, 1)} km</strong>
                </p>
                <p className="text-muted">
                  Hub mais próximo <strong className="block text-[11px] text-ink-soft">{intel.bestHub} · {num(intel.bestHubKm, 1)} km</strong>
                </p>
                {contours.length ? (
                  <p className="text-muted sm:col-span-3">
                    Curvas de nível <strong className="text-[11px] text-ink-soft">{contours.length} traçados sobrepostos à demarcação</strong>
                    {" "}· linhas em bordô indicam curvas mestras

                  </p>
                ) : null}
              </div>
            </Card>

            {city ? (
              <Card className="p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-leaf" />
                  <h2 className="text-base font-semibold">{city.name} — dados IBGE</h2>
                </div>
                <div className="mt-3">
                  <CityIndicators city={city} point={{ lat: area.lat, lng: area.lng }} />
                </div>
              </Card>
            ) : null}


          </div>

          <aside className="space-y-4">
            <Card className="p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Condição comercial</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{brl(area.totalPrice)}</p>
              <p className="text-[11px] text-muted">{brl(area.pricePerM2)}/m² · {areaLabel(area.landAreaM2)}</p>
              <div className="mt-3 space-y-1.5 border-t border-line pt-2.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted">Município</span>
                  <span className="font-semibold">{area.city}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Tipo</span>
                  <span className="font-semibold">{area.kind === "galpao" ? "Galpão / logística" : area.kind === "misto" ? "Uso misto" : "Terreno"}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-1.5">
                <a
                  href={CONTACT.whatsapp(shareText)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#128C4A] px-3 py-2.5 text-[11px] font-semibold text-white hover:bg-[#0f7a41]"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Agendar visita no WhatsApp
                </a>
                <a
                  href={CONTACT.mailto(`Interesse · ${area.code} — ${area.name}`, shareText)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2.5 text-[11px] font-semibold text-ink hover:border-leaf"
                >
                  <Mail className="h-3.5 w-3.5" /> Enviar e-mail
                </a>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2.5 text-[11px] font-medium text-ink hover:border-leaf"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-leaf" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Link copiado" : "Copiar link da apresentação"}
                </button>
              </div>
            </Card>

            {documents.length ? (
              <Card className="p-4">
                <h3 className="text-sm font-semibold">Documentos disponíveis</h3>
                <ul className="mt-2 divide-y divide-line">
                  {documents.map((document) => (
                    <li key={document.id} className="flex items-center gap-2 py-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-medium text-ink">{document.name}</p>
                        <p className="text-[9px] text-muted">{document.category}</p>
                      </div>
                      <a href={`${document.url}?download=1`} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-leaf-600" title="Baixar">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card className="p-4">
              <h3 className="text-sm font-semibold">Fale com a Land Bank Corp</h3>
              <p className="mt-1 text-[11px] font-medium text-ink-soft">{CONTACT.name}</p>
              <p className="mt-0.5 text-[11px] text-muted">{CONTACT.phoneDisplay}</p>
              <p className="text-[11px] text-muted">{CONTACT.email}</p>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                Atuação em Sumaré-SP, Região Metropolitana de Campinas e Piracicaba. Assessoria completa em land bank,
                estruturação de galpões e inteligência de mercado.
              </p>
              <Link href="/" className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-leaf-600 hover:underline">
                Conhecer o CRM completo <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Card>
          </aside>
        </div>
      </main>

      <footer className="mt-6 border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-[10px] text-muted sm:px-6">
          <p>
            Land Bank Corp | Áreas &amp; Galpões · apresentação comercial gerada em {new Date().toLocaleDateString("pt-BR")}
          </p>
          <p>Indicadores: IBGE Censo 2022 / 2010, IBGE Cidades e PNUD. Perímetros sujeitos a confirmação documental.</p>
        </div>
      </footer>
    </div>
  );
}
