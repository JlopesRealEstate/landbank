"use client";

import { useMemo, useState } from "react";
import { Camera, ChevronDown, ChevronUp, ExternalLink, Footprints, ImageIcon, MapPin, Maximize2, Navigation, X } from "lucide-react";
import { streetViewLinks } from "@/lib/streetview";
import { cn } from "@/components/ui";
import { FieldHelp } from "@/components/ui/field-help";

type Geometry = [number, number][][];

/**
 * APRESENTAÇÃO DO LOCAL — sempre funcional, sem depender de chave de API.
 * 1) Foto de satélite real recortada no perímetro do imóvel (Esri World Imagery
 *    via rota interna, com o KMZ desenhado por cima).
 * 2) Foto de fachada do dossiê (quando enviada).
 * 3) Mapa do Google embutido (embed público) para navegar o entorno.
 * 4) Atalhos de Street View / Earth / Maps / rota, que abrem sem bloqueio de API.
 */
export function PropertyImageryPanel({
  lat,
  lng,
  geometry = [],
  coverUrl,
  photoUrls = [],
  label,
  compact = false,
}: {
  lat: number;
  lng: number;
  geometry?: Geometry;
  coverUrl?: string | null;
  photoUrls?: string[];
  label?: string;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<"satelite" | "fachada" | "mapa">("satelite");
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const links = useMemo(() => streetViewLinks(lat, lng), [lat, lng]);

  const polygonPoints = geometry.flat().length
    ? geometry.flat().map(([lngPoint, latPoint]) => `${latPoint.toFixed(6)},${lngPoint.toFixed(6)}`).join(";")
    : `${lat.toFixed(6)},${lng.toFixed(6)}`;

  const imagerySrc = `/api/imagery?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&w=${compact ? 720 : 1100}&h=${
    compact ? 360 : 520
  }&pad=40&pts=${encodeURIComponent(polygonPoints)}`;

  const photos = photoUrls.length ? photoUrls : coverUrl ? [coverUrl] : [];
  const activePhoto = photos[photoIndex] ?? null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-2.5 py-1.5">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
          <MapPin className="h-3 w-3 text-[#8c2f43]" /> Apresentação do local
          <FieldHelp helpKey="mapa.streetview" label="Apresentação do local" />
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[9px] font-medium text-ink-soft hover:border-[#8c2f43] hover:text-[#8c2f43]"
            aria-expanded={open}
          >
            {open ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {open ? "Recolher" : "Expandir"}
          </button>
          <div className="flex items-center rounded-md border border-line bg-white p-0.5">
            {(
              [
                { id: "satelite", label: "Satélite", icon: MapPin },
                { id: "fachada", label: "Fachada", icon: Camera },
                { id: "mapa", label: "Rua", icon: Navigation },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTab(option.id)}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium",
                    tab === option.id ? "bg-paper text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="h-2.5 w-2.5" /> {option.label}
                </button>
              );
            })}
          </div>
          <a
            href={links.pano}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-[#8c2f43] px-2 py-0.5 text-[9px] font-semibold text-white hover:bg-[#7a2739]"
            title="Abrir o Street View oficial do Google"
          >
            <Footprints className="h-2.5 w-2.5" /> Street View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2">
          <p className="text-[10px] text-muted">
            {label ?? "Imóvel"} · satélite, fachada e mapa de rua
          </p>
          <a
            href={links.pano}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-[#8c2f43] px-2 py-0.5 text-[9px] font-semibold text-white hover:bg-[#7a2739]"
          >
            <Footprints className="h-2.5 w-2.5" /> Street View
          </a>
        </div>
      ) : (
      <>
      <div className={cn("relative bg-[#eef1ee]", compact ? "h-[210px]" : "h-[300px]")}>
        {tab === "satelite" ? (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="group relative block h-full w-full cursor-zoom-in"
            title="Ampliar imagem"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagerySrc} alt={`Imagem de satélite — ${label ?? "imóvel"}`} className="h-full w-full object-cover" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              <rect x="0" y="0" width="100" height="100" fill="none" />
            </svg>
            <span className="absolute left-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[8px] font-medium text-white">
              Imagem real · Esri World Imagery
            </span>
            <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-medium text-ink">
              <Maximize2 className="h-2.5 w-2.5" /> ampliar
            </span>
            <span className="absolute bottom-1.5 left-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[8px] text-muted">
              {label ?? "imóvel"} · {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          </button>
        ) : null}

        {tab === "fachada" ? (
          activePhoto ? (
            <div className="flex h-full flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activePhoto} alt="Fachada do imóvel" className="min-h-0 flex-1 object-cover" />
              {photos.length > 1 ? (
                <div className="flex gap-1 overflow-x-auto bg-white p-1">
                  {photos.slice(0, 8).map((photo, index) => (
                    <button
                      key={`${photo}-${index}`}
                      type="button"
                      onClick={() => setPhotoIndex(index)}
                      className={cn(
                        "h-8 w-11 shrink-0 overflow-hidden rounded border",
                        index === photoIndex ? "border-[#8c2f43]" : "border-transparent opacity-70",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
              <ImageIcon className="h-5 w-5 text-muted" />
              <p className="text-[11px] font-semibold text-ink">Nenhuma foto de fachada cadastrada</p>
              <p className="max-w-[260px] text-[9px] leading-snug text-muted">
                Envie fotos na aba “Documentos &amp; fotos” do dossiê. A primeira imagem aparece aqui e no mosaico da ficha
                em PDF.
              </p>
            </div>
          )
        ) : null}

        {tab === "mapa" ? (
          <iframe
            title={`Mapa do entorno — ${label ?? "imóvel"}`}
            src={`https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}&z=17&hl=pt-BR&output=embed`}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-1 border-t border-line p-1.5 sm:grid-cols-4">
        <a
          href={links.pano}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 rounded-md border border-line px-1.5 py-1 text-[9px] font-medium text-ink hover:border-[#8c2f43] hover:text-[#8c2f43]"
        >
          <Footprints className="h-2.5 w-2.5" /> Street View
        </a>
        <a
          href={links.earth}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-line px-1.5 py-1 text-center text-[9px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
        >
          Google Earth
        </a>
        <a
          href={links.maps}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-line px-1.5 py-1 text-center text-[9px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
        >
          Google Maps
        </a>
        <a
          href={links.directions}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1 rounded-md border border-line px-1.5 py-1 text-[9px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
        >
          <Navigation className="h-2.5 w-2.5" /> rota
        </a>
      </div>

      <p className="border-t border-line px-2 py-1 text-[8px] leading-snug text-muted">
        Imagem de satélite: Esri World Imagery · mapa de rua e Street View: Google (abrem em nova aba, sem bloqueio de API).
      </p>
      </>
      )}

      {zoomed ? (
        <div
          className="fixed inset-0 z-[1500] flex flex-col items-center justify-center bg-ink/80 p-3 backdrop-blur-sm"
          role="dialog"
          aria-label="Imagem ampliada do imóvel"
        >
          <div className="w-full max-w-4xl rounded-xl bg-white p-2">
            <div className="flex items-center justify-between gap-2 pb-1.5">
              <p className="text-[11px] font-semibold text-ink">{label ?? "Imóvel"} — imagem de satélite</p>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="rounded-md border border-line p-1 text-muted hover:border-[#8c2f43] hover:text-[#8c2f43]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/imagery?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&w=1500&h=900&pad=30&pts=${encodeURIComponent(
                polygonPoints,
              )}`}
              alt={`Imagem ampliada — ${label ?? "imóvel"}`}
              className="max-h-[75vh] w-full rounded object-contain"
            />
            <p className="pt-1 text-[9px] text-muted">
              Recorte exato do imóvel · Esri World Imagery · {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
