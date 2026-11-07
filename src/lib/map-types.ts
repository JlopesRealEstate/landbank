import type { City, GeoPolygon } from "@/db/schema";

export type BasemapId = "mapa" | "satelite" | "humanitario";

export type MapArea = {
  id: number;
  code: string;
  name: string;
  city: string;
  neighborhood: string;
  address: string;
  kind: string;
  status: string;
  lat: number;
  lng: number;
  landAreaM2: number;
  builtAreaM2: number;
  pricePerM2: number;
  totalPrice: number;
  zoning: string;
  environmentalRestriction: boolean;
  score: number;
  grade: string;
  coverUrl: string | null;
  photos?: { id: number; url: string; name: string; category: string }[];
  photoCount: number;
  documentCount: number;
  geometry: GeoPolygon[];
  cityData: City | null;
  listingUrl?: string | null;
};

export const BASEMAPS: Record<
  BasemapId,
  { label: string; short: string; url: string; attribution: string; maxZoom: number; note: string }
> = {
  mapa: {
    label: "Mapa",
    short: "Mapa",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    note: "OpenStreetMap padrão",
  },
  satelite: {
    label: "Satélite",
    short: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagens &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
    note: "Imagem de satélite (Esri World Imagery)",
  },
  humanitario: {
    label: "Humanitário",
    short: "Humanitário",
    url: "https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · estilo HOT',
    maxZoom: 20,
    note: "Estilo humanitário OSM (HOT)",
  },
};
