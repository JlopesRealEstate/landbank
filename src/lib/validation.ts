import type { GeoPolygon, NewArea } from "@/db/schema";
import { isValidLatLng } from "@/lib/geo";
import { slugSafe } from "@/lib/format";
import { findCity } from "@/lib/cities";

const KIND_VALUES = new Set(["terreno", "galpao", "misto"]);
const STATUS_VALUES = new Set(["disponivel", "em_estudo", "em_negociacao", "reservado", "vendido", "cancelado"]);
const TRANSACTION_VALUES = new Set(["venda", "locacao"]);

type Loose = Record<string, unknown>;

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value.trim() : value === null || value === undefined ? fallback : String(value).trim();

const positive = (value: unknown): number => {
  const parsed = typeof value === "string" ? Number(value.replace(/\./g, "").replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

function sanitizeGeometry(value: unknown): GeoPolygon[] {
  if (!Array.isArray(value)) return [];
  const polygons: GeoPolygon[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const coordinates = (entry as Loose).coordinates;
    if (!Array.isArray(coordinates)) continue;
    const ring: [number, number][] = [];
    for (const point of coordinates) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const lng = Number(point[0]);
      const lat = Number(point[1]);
      if (!isValidLatLng(lat, lng)) continue;
      ring.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
    }
    if (ring.length >= 3) {
      polygons.push({
        coordinates: ring,
        label: text((entry as Loose).label) || undefined,
      });
    }
  }
  return polygons;
}

export type ParsedArea = { value: NewArea; errors: string[] };

export function parseAreaInput(body: unknown): ParsedArea {
  const errors: string[] = [];
  const input: Loose = body && typeof body === "object" ? (body as Loose) : {};

  const name = text(input.name);
  if (name.length < 4) errors.push("Informe o nome do imóvel (mínimo de 4 caracteres).");

  let city = text(input.city);
  let citySlug = text(input.citySlug);
  const seed = findCity(city) ?? findCity(citySlug);
  if (!city && seed) city = seed.name;
  if (seed) citySlug = seed.slug;
  if (!city) errors.push("Informe o município do imóvel.");
  if (!citySlug && city) {
    citySlug = city
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
  }

  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!isValidLatLng(lat, lng)) errors.push("Coordenadas inválidas — selecione o ponto no mapa ou importe um KMZ.");

  const landAreaM2 = positive(input.landAreaM2);
  const builtAreaM2 = positive(input.builtAreaM2);
  const pricePerM2 = positive(input.pricePerM2);
  let totalPrice = positive(input.totalPrice);
  if (totalPrice === 0 && pricePerM2 > 0 && landAreaM2 > 0) {
    totalPrice = Math.round(pricePerM2 * landAreaM2);
  }
  if (landAreaM2 <= 0) errors.push("Informe a metragem do terreno em m².");
  if (pricePerM2 <= 0) errors.push("Informe o valor por m².");

  const kind = text(input.kind, "terreno");
  const status = text(input.status, "disponivel");
  if (!KIND_VALUES.has(kind)) errors.push("Tipo de imóvel inválido.");
  if (!STATUS_VALUES.has(status)) errors.push("Status inválido.");

  const transaction = text(input.transaction, "venda");
  if (!TRANSACTION_VALUES.has(transaction)) errors.push("Tipo de transação inválido (venda ou locação).");

  const listingUrlRaw = text(input.listingUrl);
  let listingUrl = "";
  if (listingUrlRaw) {
    const normalized = /^https?:\/\//i.test(listingUrlRaw) ? listingUrlRaw : `https://${listingUrlRaw}`;
    try {
      const parsed = new URL(normalized);
      const hostIsValid = parsed.hostname.includes(".") && !parsed.hostname.startsWith(".") && parsed.hostname.length >= 4;
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && hostIsValid) {
        listingUrl = parsed.toString();
      } else {
        errors.push("Link do anúncio inválido. Ex.: https://www.portaldocorretor.com.br/imovel/123");
      }
    } catch {
      errors.push("Link do anúncio inválido. Ex.: https://www.portaldocorretor.com.br/imovel/123");
    }
  }

  const geometry = sanitizeGeometry(input.geometry);
  const code =
    text(input.code) ||
    `${slugSafe(city).slice(0, 3).padEnd(3, "X")}-${Math.floor(100 + Math.random() * 900)}`;

  const value: NewArea = {
    code,
    name,
    kind,
    status,
    description: text(input.description),
    city,
    citySlug,
    neighborhood: text(input.neighborhood),
    address: text(input.address),
    zipCode: text(input.zipCode),
    lat,
    lng,
    landAreaM2,
    builtAreaM2,
    pricePerM2,
    totalPrice,
    zoning: text(input.zoning),
    zoningNotes: text(input.zoningNotes),
    environmentalRestriction: Boolean(input.environmentalRestriction),
    environmentalNotes: text(input.environmentalNotes),
    geometry,
    kmzFileName: text(input.kmzFileName) || null,
    transaction,
    partnerName: text(input.partnerName),
    partnerPhone: text(input.partnerPhone),
    listingUrl,
    ownerName: text(input.ownerName),
    contactName: text(input.contactName),
    contactPhone: text(input.contactPhone),
    contactEmail: text(input.contactEmail),
    featured: Boolean(input.featured),
  };

  return { value, errors };
}

// No extension/MIME allow-list: private Storage access is controlled by Auth and RLS.
export const MAX_UPLOAD_BYTES = 9 * 1024 * 1024;

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-() ]+/g, "_").slice(0, 160) || "arquivo";
}

export function isAllowedMime(mime: string): boolean {
  return typeof mime === "string" && mime.trim().length > 0;
}
