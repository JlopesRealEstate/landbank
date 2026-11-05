"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Database,
  FileUp,
  Loader2,
  MapPin,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { GeoPolygon } from "@/db/schema";
import { parseKmzFile } from "@/lib/kmz";
import { reverseGeocode } from "@/lib/geocode";
import { distanceKm } from "@/lib/geo";
import { KIND_LABELS, STATUS_LABELS, TRANSACTION_LABELS, areaLabel, brl, num } from "@/lib/format";
import { Card, Eyebrow, cn } from "@/components/ui";
import { FieldHelp } from "@/components/ui/field-help";
import { MapPicker } from "@/components/map/map-picker";

export type CityOption = {
  slug: string;
  name: string;
  region: string;
  population2022: number;
  avgIncome: number;
  idhm: number;
  marketPriceM2: number;
  gdpPerCapita: number;
  areaKm2: number;
  lat: number;
  lng: number;
  hasIndicators?: boolean;
};

export type AreaFormInitial = {
  id?: number;
  code: string;
  name: string;
  kind: string;
  status: string;
  description: string;
  city: string;
  citySlug: string;
  neighborhood: string;
  address: string;
  zipCode: string;
  lat: number;
  lng: number;
  landAreaM2: number;
  builtAreaM2: number;
  pricePerM2: number;
  totalPrice: number;
  zoning: string;
  zoningNotes: string;
  environmentalRestriction: boolean;
  environmentalNotes: string;
  ownerName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  featured: boolean;
  geometry: GeoPolygon[];
  kmzFileName: string | null;
  transaction: string;
  partnerName: string;
  partnerPhone: string;
  listingUrl: string;
};

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-leaf focus:ring-2 focus:ring-leaf/15";
const labelClass = "text-[10px] font-semibold uppercase tracking-[0.12em] text-muted";

function Field({
  label,
  children,
  hint,
  className,
  help,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
  help?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className={cn(labelClass, "flex items-center gap-1")}>
        {label}
        {help ? <FieldHelp helpKey={help} label={label} /> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-[10px] text-muted">{hint}</span> : null}
    </label>
  );
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchCity(cities: CityOption[], value: string): CityOption | undefined {
  const target = normalize(value);
  if (!target) return undefined;
  return (
    cities.find((city) => normalize(city.name) === target) ??
    cities.find((city) => target.includes(normalize(city.name))) ??
    cities.find((city) => normalize(city.name).includes(target))
  );
}

/** Geocodificação reversa via rota interna (sem CORS) com fallback para o cliente. */
async function reverseGeocodeServer(lat: number, lng: number) {
  try {
    const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (response.ok) {
      const data = (await response.json()) as {
        ok: boolean;
        city?: string;
        neighborhood?: string;
        road?: string;
        postcode?: string;
        state?: string;
      };
      if (data.ok) {
        return {
          city: data.city ?? "",
          neighborhood: data.neighborhood ?? "",
          road: data.road ?? "",
          postcode: data.postcode ?? "",
          state: data.state ?? "São Paulo",
        };
      }
    }
  } catch {
    // segue para fallback
  }
  return reverseGeocode(lat, lng);
}

/** Compara nomes tolerando sufixos/prefixos e grafias ("Sumaré" × "Sumare"). */
function matchCityByFuzzy(list: CityOption[], value: string): CityOption | undefined {
  const target = normalize(value);
  if (!target) return undefined;
  return (
    list.find((item) => normalize(item.name) === target) ??
    list.find((item) => normalize(item.name).startsWith(target) || target.startsWith(normalize(item.name))) ??
    list.find((item) => normalize(item.name).includes(target) || target.includes(normalize(item.name)))
  );
}

/** Fallback quando a geocodificação reversa está indisponível: município mais próximo da base regional. */
function nearestCity(cities: CityOption[], point: { lat: number; lng: number }): CityOption | undefined {
  let best: { city: CityOption; km: number } | undefined;
  for (const city of cities) {
    if (!city.lat || !city.lng) continue;
    const km = distanceKm(point, { lat: city.lat, lng: city.lng });
    if (!best || km < best.km) best = { city, km };
  }
  return best && best.km <= 90 ? best.city : undefined;
}

const EMPTY: AreaFormInitial = {
  code: "",
  name: "",
  kind: "terreno",
  status: "disponivel",
  description: "",
  city: "",
  citySlug: "",
  neighborhood: "",
  address: "",
  zipCode: "",
  lat: -22.8219,
  lng: -47.2669,
  landAreaM2: 0,
  builtAreaM2: 0,
  pricePerM2: 0,
  totalPrice: 0,
  zoning: "",
  zoningNotes: "",
  environmentalRestriction: false,
  environmentalNotes: "",
  ownerName: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  featured: false,
  geometry: [],
  kmzFileName: null,
  transaction: "venda",
  partnerName: "",
  partnerPhone: "",
  listingUrl: "",
};

type FormState = Omit<AreaFormInitial, "lat" | "lng" | "landAreaM2" | "builtAreaM2" | "pricePerM2" | "totalPrice"> & {
  lat: string;
  lng: string;
  landAreaM2: string;
  builtAreaM2: string;
  pricePerM2: string;
  totalPrice: string;
};

function toFormState(initial: AreaFormInitial): FormState {
  return {
    ...initial,
    lat: String(initial.lat),
    lng: String(initial.lng),
    landAreaM2: initial.landAreaM2 ? String(initial.landAreaM2) : "",
    builtAreaM2: initial.builtAreaM2 ? String(initial.builtAreaM2) : "",
    pricePerM2: initial.pricePerM2 ? String(initial.pricePerM2) : "",
    totalPrice: initial.totalPrice ? String(initial.totalPrice) : "",
  };
}

export function AreaForm({
  cities,
  initial,
  mode,
}: {
  cities: CityOption[];
  initial?: AreaFormInitial;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const base = initial ?? EMPTY;
  const [form, setForm] = useState<FormState>(() => toFormState(base));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [kmz, setKmz] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string; details?: string }>({
    state: "idle",
    message: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [kmzFile, setKmzFile] = useState<File | null>(null);
  const [cityQuery, setCityQuery] = useState(base.city ?? "");
  const [cityList, setCityList] = useState<CityOption[]>(cities);
  const [enriching, setEnriching] = useState<{ state: "idle" | "loading" | "ok" | "error"; message: string }>({
    state: "idle",
    message: "",
  });

  const city = cityList.find((item) => item.slug === form.citySlug);
  const suggestedTotal =
    Number(form.pricePerM2 || 0) > 0 && Number(form.landAreaM2 || 0) > 0
      ? Math.round(Number(form.pricePerM2) * Number(form.landAreaM2))
      : 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /** Carrega (uma única vez) e grava os indicadores IBGE do município selecionado. */
  async function ensureCityLoaded(target?: CityOption): Promise<CityOption | undefined> {
    const selected = target ?? cityList.find((item) => item.slug === form.citySlug);
    if (!selected) return undefined;
    if (selected.hasIndicators || (selected.population2022 ?? 0) > 0) return selected;

    setEnriching({ state: "loading", message: `Carregando indicadores IBGE de ${selected.name}…` });
    try {
      const response = await fetch("/api/ibge/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selected.slug,
          name: selected.name,
          ibgeCode: /^\d{7}$/.test(selected.slug) ? selected.slug : undefined,
          lat: selected.lat,
          lng: selected.lng,
        }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        status?: string;
        city?: {
          slug: string;
          name: string;
          region: string;
          population2022: number;
          avgIncome: number;
          medianIncome: number;
          idhm: number;
          marketPriceM2: number;
          gdpPerCapita: number;
          areaKm2: number;
          lat: number;
          lng: number;
          source: string;
        };
        message?: string;
        source?: string;
      };
      if (!data.city) throw new Error(data.message ?? "Falha ao carregar indicadores.");
      const enriched: CityOption = {
        slug: data.city.slug,
        name: data.city.name,
        region: data.city.region,
        population2022: data.city.population2022,
        avgIncome: data.city.avgIncome,
        idhm: data.city.idhm,
        marketPriceM2: data.city.marketPriceM2,
        gdpPerCapita: data.city.gdpPerCapita,
        areaKm2: data.city.areaKm2,
        lat: data.city.lat,
        lng: data.city.lng,
        hasIndicators: data.city.population2022 > 0 && data.city.avgIncome > 0,
      };
      setCityList((current) => current.map((item) => (item.slug === enriched.slug ? { ...item, ...enriched } : item)));
      setEnriching({
        state: data.status === "unavailable" ? "error" : "ok",
        message: data.message ?? "Indicadores atualizados.",
      });
      return enriched;
    } catch (error) {
      setEnriching({
        state: "error",
        message: error instanceof Error ? error.message : "Não foi possível carregar os indicadores agora.",
      });
      return selected;
    }
  }

  function pickCity(slug: string) {
    const selected = cityList.find((item) => item.slug === slug);
    if (!selected) return;
    setCityQuery(selected.name);
    setForm((current) => ({ ...current, citySlug: slug, city: selected.name }));
    void ensureCityLoaded(selected);
  }

  async function handleKmz(file: File | undefined) {
    if (!file) return;
    setKmz({ state: "loading", message: `Lendo ${file.name}…` });
    try {
      const result = await parseKmzFile(file);
      setKmzFile(file);
      setForm((current) => ({
        ...current,
        name: current.name || result.name,
        description: current.description || result.description,
        kind: /galp|armaz|warehouse|log[ií]stic/i.test(`${result.name} ${result.description}`) ? "galpao" : current.kind,
        lat: result.center ? String(result.center.lat) : current.lat,
        lng: result.center ? String(result.center.lng) : current.lng,
        landAreaM2: result.totalAreaM2 > 0 ? String(Math.round(result.totalAreaM2)) : current.landAreaM2,
        geometry: result.polygons,
        kmzFileName: file.name,
      }));

      let cityNote = "";
      if (result.center) {
        // geocodificação reversa no servidor (sem bloqueio de CORS) + fallback local
        const geo = await reverseGeocodeServer(result.center.lat, result.center.lng);
        const matched =
          (geo?.city ? matchCity(cityList, geo.city) : undefined) ??
          nearestCity(cityList, result.center) ??
          (geo?.city ? matchCityByFuzzy(cityList, geo.city) : undefined);

        if (matched) {
          setCityQuery(matched.name);
          setForm((current) => ({
            ...current,
            city: matched.name,
            citySlug: matched.slug,
            neighborhood: current.neighborhood || geo?.neighborhood || current.neighborhood,
            zipCode: current.zipCode || geo?.postcode || current.zipCode,
            address: current.address || [geo?.road, geo?.neighborhood].filter(Boolean).join(", ") || current.address,
          }));
          const loaded = await ensureCityLoaded(matched);
          const hasData = (loaded?.population2022 ?? 0) > 0;
          cityNote = hasData
            ? ` · Município ${matched.name} detectado pelo KMZ e indicadores IBGE carregados: ${num(loaded!.population2022)} hab, renda ${brl(loaded!.avgIncome)}, IDHM ${loaded!.idhm.toFixed(3)}.`
            : ` · Município ${matched.name} detectado pelo KMZ. Indicadores IBGE ainda não disponíveis — use "Carregar IBGE" na ficha do município.`;
        } else if (geo?.city) {
          cityNote = ` · Município detectado: ${geo.city}. Selecione a cidade para vincular o IBGE.`;
        } else {
          cityNote = " · Não foi possível identificar o município automaticamente. Selecione a cidade na lista.";
        }
      }

      const area = result.totalAreaM2 > 0 ? ` · ${areaLabel(result.totalAreaM2)} (${num(result.totalAreaM2)} m²) calculados` : "";
      setKmz({
        state: "ok",
        message: `KMZ importado: ${result.polygons.length} polígono(s) e ${result.points.length} ponto(s)${area}.${cityNote}`,
        details: result.fileNames.join(" · "),
      });
    } catch (error) {
      setKmz({
        state: "error",
        message: error instanceof Error ? error.message : "Não foi possível ler o arquivo KMZ.",
      });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    const payload = {
      ...form,
      city: form.city || cityQuery,
      lat: Number(form.lat),
      lng: Number(form.lng),
      landAreaM2: Number(form.landAreaM2 || 0),
      builtAreaM2: Number(form.builtAreaM2 || 0),
      pricePerM2: Number(form.pricePerM2 || 0),
      totalPrice: Number(form.totalPrice || 0),
    };
    try {
      const response = await fetch(mode === "create" ? "/api/areas" : `/api/areas/${initial?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok: boolean; errors?: string[]; error?: string; area?: { id: number } };
      if (!response.ok || !data.ok) {
        setErrors(data.errors?.length ? data.errors : [data.error ?? "Não foi possível salvar o imóvel."]);
        setBusy(false);
        return;
      }
      const savedId = data.area?.id ?? initial?.id;
      if (savedId && kmzFile && kmzFile.size <= 9 * 1024 * 1024) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = () => reject(new Error("Falha ao ler KMZ"));
          reader.readAsDataURL(kmzFile);
        }).catch(() => "");
        if (base64) {
          await fetch(`/api/areas/${savedId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: [
                {
                  kind: "document",
                  category: "KMZ",
                  name: kmzFile.name,
                  mimeType: kmzFile.type || "application/vnd.google-earth.kmz",
                  data: base64,
                },
              ],
            }),
          }).catch(() => undefined);
        }
      }
      router.push(`/areas/${savedId}`);
      router.refresh();
    } catch {
      setErrors(["Falha de conexão ao salvar. Tente novamente."]);
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!initial?.id) return;
    if (!window.confirm("Excluir este imóvel e todos os arquivos do dossiê? Esta ação não pode ser desfeita.")) return;
    setDeleting(true);
    const response = await fetch(`/api/areas/${initial.id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/areas");
      router.refresh();
    } else {
      setErrors(["Não foi possível excluir o imóvel."]);
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-line bg-leaf-50/60 px-3 py-2 text-[11px] text-ink-soft">
        <strong className="text-ink">Precisa de ajuda para preencher?</strong> Cada campo tem um ícone
        <span className="mx-1 inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[#8c2f43] text-[9px] font-bold text-[#8c2f43]">
          ?
        </span>
        — passe o mouse (ou toque no celular) para ver o que é, como preencher e o detalhe técnico. Manual completo em{" "}
        <a href="/documentacao" className="font-semibold text-leaf-600 underline">
          Documentação
        </a>
        .
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <Eyebrow>Etapa 1</Eyebrow>
            <h2 className="mt-1 text-base font-semibold">Identificação do imóvel</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field help="identificacao.name" label="Nome do imóvel *" className="sm:col-span-2">
                <input
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Ex.: Galpão Logístico Sumaré — Eixo Anhanguera"
                  className={inputClass}
                  required
                />
              </Field>
              <Field help="identificacao.code" label="Código do imóvel" hint="Gerado automaticamente se vazio">
                <input
                  value={form.code}
                  onChange={(event) => update("code", event.target.value.toUpperCase())}
                  placeholder="SUM-011"
                  className={inputClass}
                  disabled={mode === "edit"}
                />
              </Field>
              <Field help="identificacao.status" label="Status comercial">
                <select value={form.status} onChange={(event) => update("status", event.target.value)} className={inputClass}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field help="identificacao.transaction" label="Transação" hint="Separa o quadro de M² da região entre venda e locação">
                <div className="flex gap-2">
                  {Object.entries(TRANSACTION_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update("transaction", value)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition",
                        form.transaction === value
                          ? "border-[#8c2f43] bg-[#f6e8eb] text-[#8c2f43]"
                          : "border-line bg-white text-ink-soft hover:border-[#8c2f43]/40",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field help="identificacao.kind" label="Tipo de ativo" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update("kind", value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-medium transition",
                        form.kind === value
                          ? "border-leaf bg-leaf-50 text-leaf-600"
                          : "border-line bg-white text-ink-soft hover:border-leaf/50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field help="identificacao.description" label="Descrição do imóvel" className="sm:col-span-2" hint="Use este campo para a narrativa comercial do ativo.">
                <textarea
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  rows={4}
                  placeholder="Descreva o imóvel, infraestrutura, diferenciais e tese de investimento."
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => update("featured", event.target.checked)}
                  className="h-4 w-4 rounded border-line accent-[#17875f]"
                />
                <span className="flex items-center gap-1 text-xs text-ink-soft">
                  Destacar este ativo no portfólio de apresentação
                  <FieldHelp helpKey="identificacao.featured" label="Destaque no portfólio" />
                </span>
              </label>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Eyebrow>Etapa 2</Eyebrow>
                <h2 className="mt-1 text-base font-semibold">Localização &amp; perímetro KMZ</h2>
              </div>
              <span className="rounded-full bg-leaf-50 px-2.5 py-1 text-[10px] font-medium text-leaf-600">
                Importação com IBGE automático
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field
                help="localizacao.city"
                label="Município (Estado de São Paulo) *"
                hint={`${cityList.length} municípios de SP na base IBGE · digite para buscar e carregar indicadores`}
              >
                <input
                  list="sp-municipios"
                  value={cityQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCityQuery(value);
                    const match = cityList.find((option) => option.name.toLowerCase() === value.toLowerCase());
                    if (match) pickCity(match.slug);
                  }}
                  placeholder="Digite o município — ex.: Sumaré"
                  className={inputClass}
                  required
                />
                <datalist id="sp-municipios">
                  {cityList.map((option) => (
                    <option key={option.slug} value={option.name}>
                      {option.hasIndicators ? "IBGE com indicadores" : "SP · IBGE localidades"}
                    </option>
                  ))}
                </datalist>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(["Sumaré", "Campinas", "Piracicaba", "Nova Odessa", "Hortolândia"].map((name) =>
                    cityList.find((option) => option.name === name),
                  ).filter(Boolean) as CityOption[]).map((option) => (
                    <button
                      key={option.slug}
                      type="button"
                      onClick={() => {
                        pickCity(option.slug);
                        setCityQuery(option.name);
                      }}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[9px] font-medium transition",
                        form.citySlug === option.slug
                          ? "border-leaf bg-leaf-50 text-leaf-600"
                          : "border-line bg-white text-muted hover:border-leaf/50",
                      )}
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              </Field>
              <Field help="localizacao.neighborhood" label="Bairro / distrito">
                <input value={form.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} className={inputClass} />
              </Field>
              <Field help="localizacao.address" label="Endereço completo" className="sm:col-span-2">
                <input
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  placeholder="Rodovia, km, número, referência"
                  className={inputClass}
                />
              </Field>
              <Field help="localizacao.zipCode" label="CEP">
                <input value={form.zipCode} onChange={(event) => update("zipCode", event.target.value)} className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field help="localizacao.lat" label="Latitude">
                  <input value={form.lat} onChange={(event) => update("lat", event.target.value)} className={inputClass} />
                </Field>
                <Field help="localizacao.lng" label="Longitude">
                  <input value={form.lng} onChange={(event) => update("lng", event.target.value)} className={inputClass} />
                </Field>
              </div>
            </div>

            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleKmz(event.dataTransfer.files?.[0]);
              }}
              className="mt-4 rounded-xl border border-dashed border-leaf/40 bg-leaf-50/40 p-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-leaf shadow-sm">
                    <FileUp className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="flex items-center gap-1 text-xs font-semibold text-ink">
                      Anexar arquivo KMZ ou KML <FieldHelp helpKey="localizacao.kmz" label="Importação de KMZ" />
                    </p>
                    <p className="text-[10px] text-muted">
                      Importa perímetro, ponto central, metragem calculada, nome e dados do município.
                    </p>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
                  className="hidden"
                  onChange={(event) => void handleKmz(event.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-medium text-white hover:bg-forest-600"
                >
                  {kmz.state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Selecionar arquivo
                </button>
              </div>
              {kmz.state !== "idle" ? (
                <div
                  className={cn(
                    "mt-2.5 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px]",
                    kmz.state === "error" && "bg-red-50 text-red-700",
                    kmz.state === "ok" && "bg-white text-ink-soft",
                    kmz.state === "loading" && "bg-white text-muted",
                  )}
                >
                  {kmz.state === "ok" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-leaf" /> : null}
                  {kmz.state === "error" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
                  <div>
                    <p>{kmz.message}</p>
                    {kmz.details ? <p className="mt-0.5 text-[10px] text-muted">{kmz.details}</p> : null}
                    {form.geometry.length ? (
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-leaf-600">
                        <MapPin className="h-3 w-3" /> Perímetro será salvo com {form.geometry.length} polígono(s) e{" "}
                        {num(form.geometry.reduce((sum, polygon) => sum + (polygon.areaM2 ?? 0), 0))} m² calculados.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {form.kmzFileName ? (
                <p className="mt-2 text-[10px] text-muted">
                  Arquivo vinculado: <strong className="text-ink-soft">{form.kmzFileName}</strong>
                </p>
              ) : null}
              <p className="mt-2 text-[10px] text-muted">
                Não tem um arquivo agora?{" "}
                <a href="/docs/exemplo-area-sumare.kmz" download className="font-medium text-leaf-600 hover:underline">
                  Baixe o KMZ de exemplo
                </a>{" "}
                e teste a importação com o perímetro de Sumaré.
              </p>
            </div>

            <div className="mt-4">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                Localização no mapa <FieldHelp helpKey="localizacao.map" label="Mapa do cadastro" />
              </p>
              <MapPicker
                lat={Number(form.lat) || null}
                lng={Number(form.lng) || null}
                geometry={form.geometry}
                onPick={(point) => {
                  update("lat", String(point.lat));
                  update("lng", String(point.lng));
                }}
              />
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <Eyebrow>Etapa 3</Eyebrow>
            <h2 className="mt-1 text-base font-semibold">Metragens, valores e zoneamento</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field help="metragens.landAreaM2" label="Área do terreno (m²) *" hint={Number(form.landAreaM2) > 0 ? areaLabel(Number(form.landAreaM2)) : undefined}>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.landAreaM2}
                  onChange={(event) => update("landAreaM2", event.target.value)}
                  className={inputClass}
                  required
                />
              </Field>
              <Field help="metragens.builtAreaM2" label="Área construída (m²)" hint={Number(form.builtAreaM2) > 0 ? areaLabel(Number(form.builtAreaM2)) : "Opcional para terrenos"}>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.builtAreaM2}
                  onChange={(event) => update("builtAreaM2", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field help="metragens.pricePerM2" label="Valor por m² (R$) *">
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.pricePerM2}
                  onChange={(event) => update("pricePerM2", event.target.value)}
                  className={inputClass}
                  required
                />
              </Field>
              <Field
                label="Valor total (R$)"
                hint={suggestedTotal > 0 ? `Sugestão: ${brl(suggestedTotal)} (m² × área do terreno)` : undefined}
              >
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={form.totalPrice}
                    onChange={(event) => update("totalPrice", event.target.value)}
                    className={inputClass}
                  />
                  {suggestedTotal > 0 ? (
                    <button
                      type="button"
                      onClick={() => update("totalPrice", String(suggestedTotal))}
                      className="shrink-0 rounded-lg border border-line px-2 text-[10px] font-medium text-leaf-600 hover:border-leaf"
                    >
                      usar
                    </button>
                  ) : null}
                </div>
              </Field>
              <Field help="metragens.zoning" label="Zoneamento">
                <input
                  value={form.zoning}
                  onChange={(event) => update("zoning", event.target.value)}
                  placeholder="Ex.: Zona Industrial 1 (ZI-1)"
                  className={inputClass}
                />
              </Field>
              <Field help="metragens.zoningNotes" label="Observações de zoneamento">
                <input
                  value={form.zoningNotes}
                  onChange={(event) => update("zoningNotes", event.target.value)}
                  placeholder="Parâmetros, coeficientes, restrições"
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 rounded-lg border border-line bg-paper/50 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.environmentalRestriction}
                    onChange={(event) => update("environmentalRestriction", event.target.checked)}
                    className="h-4 w-4 rounded border-line accent-[#c58a1a]"
                  />
                  <span className="flex items-center gap-1 text-xs font-medium text-ink-soft">
                    Imóvel com restrição ambiental
                    <FieldHelp helpKey="metragens.environmentalRestriction" label="Restrição ambiental" />
                  </span>
                </label>
              </div>
              {form.environmentalRestriction ? (
                <Field help="metragens.environmentalNotes" label="Detalhes da restrição ambiental" className="sm:col-span-2">
                  <textarea
                    value={form.environmentalNotes}
                    onChange={(event) => update("environmentalNotes", event.target.value)}
                    rows={3}
                    placeholder="APP, reserva legal, dutos, licenciamento, compensações…"
                    className={inputClass}
                  />
                </Field>
              ) : null}
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <Eyebrow>Etapa 4</Eyebrow>
            <h2 className="mt-1 text-base font-semibold">Proprietário e contato</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field help="contatos.ownerName" label="Proprietário / empresa">
                <input value={form.ownerName} onChange={(event) => update("ownerName", event.target.value)} className={inputClass} />
              </Field>
              <Field help="contatos.contactName" label="Contato responsável">
                <input value={form.contactName} onChange={(event) => update("contactName", event.target.value)} className={inputClass} />
              </Field>
              <Field help="contatos.contactPhone" label="Telefone / WhatsApp" hint="Somente números com DDI, ex.: 5519994960304">
                <input value={form.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} className={inputClass} />
              </Field>
              <Field help="contatos.contactEmail" label="E-mail">
                <input type="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} className={inputClass} />
              </Field>
              <Field help="contatos.partnerName" label="Parceiro corretor — nome" hint="Preenchimento manual">
                <input value={form.partnerName} onChange={(event) => update("partnerName", event.target.value)} placeholder="Ex.: Nome do corretor parceiro" className={inputClass} />
              </Field>
              <Field help="contatos.partnerPhone" label="Parceiro corretor — telefone" hint="Com DDI, ex.: 5519999999999">
                <input value={form.partnerPhone} onChange={(event) => update("partnerPhone", event.target.value)} className={inputClass} />
              </Field>
              <Field
                help="contatos.listingUrl"
                label="Link do anúncio"
                hint="URL externa do anúncio (portal, site próprio, vídeo). Aparece na ficha, no dossiê e no mapa interativo."
                className="sm:col-span-2"
              >
                <div className="flex gap-1.5">
                  <input
                    type="url"
                    value={form.listingUrl}
                    onChange={(event) => update("listingUrl", event.target.value)}
                    placeholder="https://www.portaldocorretor.com.br/imovel/12345"
                    className={inputClass}
                  />
                  {form.listingUrl ? (
                    <a
                      href={/^https?:\/\//i.test(form.listingUrl) ? form.listingUrl : `https://${form.listingUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-[10px] font-medium text-ink hover:border-leaf hover:text-leaf-600"
                      title="Abrir anúncio"
                    >
                      abrir
                    </a>
                  ) : null}
                </div>
              </Field>
            </div>
            <p className="mt-3 rounded-lg bg-paper/70 p-2.5 text-[10px] leading-relaxed text-muted">
              Fotos, plantas, matrículas, projetos e mapas podem ser anexados na aba <strong>Documentos</strong> do dossiê,
              logo após salvar o cadastro.
            </p>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-leaf" />
              <h3 className="text-sm font-semibold">Dados IBGE do município</h3>
            </div>
            {enriching.state !== "idle" ? (
              <p
                className={cn(
                  "mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-snug",
                  enriching.state === "loading" && "bg-paper text-muted",
                  enriching.state === "ok" && "bg-leaf-50 text-leaf-600",
                  enriching.state === "error" && "bg-[#f6e8eb] text-[#8c2f43]",
                )}
              >
                {enriching.state === "loading" ? <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" /> : null}
                {enriching.message}
              </p>
            ) : null}

            {city ? (
              <div className="mt-3 space-y-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink">{city.name}</p>
                  <p className="text-[10px] text-muted">{city.region}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "População 2022", value: num(city.population2022) },
                    { label: "Renda média", value: brl(city.avgIncome) },
                    { label: "IDHM", value: city.idhm.toFixed(3) },
                    { label: "PIB per capita", value: brl(city.gdpPerCapita) },
                    { label: "Benchmark solo", value: `${brl(city.marketPriceM2)}/m²` },
                    { label: "Área territorial", value: `${num(city.areaKm2)} km²` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-paper/70 px-2 py-1.5">
                      <p className="text-[9px] uppercase tracking-[0.08em] text-muted">{item.label}</p>
                      <p className="text-[11px] font-semibold tabular-nums text-ink">{item.value}</p>
                    </div>
                  ))}
                </div>
                {!city.hasIndicators && (city.population2022 ?? 0) === 0 ? (
                  <button
                    type="button"
                    onClick={() => void ensureCityLoaded(city)}
                    disabled={enriching.state === "loading"}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-leaf bg-white py-1.5 text-[10px] font-semibold text-leaf-600 hover:bg-leaf-50 disabled:opacity-60"
                  >
                    {enriching.state === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                    Carregar indicadores do IBGE
                  </button>
                ) : (
                  <p className="rounded-lg bg-leaf-50/60 px-2 py-1 text-[9px] leading-snug text-leaf-600">
                    Indicadores gravados no CRM (carregamento único, consulta leve).
                  </p>
                )}
                <p className="text-[10px] leading-relaxed text-muted">
                  Fonte: IBGE Censo 2022 / Censo 2010 / IBGE Cidades / PNUD. Ao importar um KMZ, o município e o bairro são
                  detectados e estes indicadores são carregados e gravados automaticamente.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-muted">
                Selecione o município ou importe um KMZ para carregar população, renda, IDHM e benchmark de solo.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-leaf" />
              <h3 className="text-sm font-semibold">Resumo do cadastro</h3>
            </div>
            <dl className="mt-3 space-y-2 text-[11px]">
              {[
                { label: "Terreno", value: Number(form.landAreaM2) > 0 ? areaLabel(Number(form.landAreaM2)) : "—" },
                { label: "Construção", value: Number(form.builtAreaM2) > 0 ? `${num(Number(form.builtAreaM2))} m²` : "—" },
                { label: "R$/m²", value: Number(form.pricePerM2) > 0 ? brl(Number(form.pricePerM2)) : "—" },
                {
                  label: "Valor total",
                  value:
                    Number(form.totalPrice) > 0
                      ? brl(Number(form.totalPrice))
                      : suggestedTotal > 0
                        ? `≈ ${brl(suggestedTotal)}`
                        : "—",
                },
                { label: "Perímetro", value: form.geometry.length ? `${form.geometry.length} polígono(s)` : "sem KMZ" },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-2 border-b border-dashed border-line pb-1.5 last:border-0">
                  <dt className="text-muted">{row.label}</dt>
                  <dd className="font-semibold tabular-nums text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold">Boas práticas do dossiê</h3>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-muted">
              <li>• Anexe o KMZ oficial do perímetro para validar a área no satélite.</li>
              <li>• Inclua matrícula, planta e projeto para reduzir o tempo de due diligence.</li>
              <li>• Registre o zoneamento e restrições antes de apresentar ao cliente.</li>
              <li>• Atualize o valor por m² com o benchmark do município.</li>
            </ul>
          </Card>
        </aside>
      </div>

      {errors.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <p className="font-semibold">Revise os campos abaixo:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/95 p-2.5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <Link href={mode === "edit" && initial?.id ? `/areas/${initial.id}` : "/areas"} className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink hover:border-leaf">
            Cancelar
          </Link>
          {mode === "edit" && initial?.id ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Excluir
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <p className="hidden text-[10px] text-muted sm:block">
            {form.kmzFileName ? "KMZ anexado · " : ""}
            {form.geometry.length ? "perímetro pronto para o mapa" : "adicione o perímetro para melhor score"}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-600 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-[#e9b7c1]" />}
            {mode === "create" ? "Cadastrar área" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </form>
  );
}
