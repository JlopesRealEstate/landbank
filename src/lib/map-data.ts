import type { City } from "@/db/schema";
import type { AreaRecord } from "@/lib/intelligence";
import { buildIntel } from "@/lib/intelligence";
import type { MapArea } from "@/lib/map-types";

export function toMapArea(area: AreaRecord, city: City | undefined): MapArea {
  const intel = buildIntel(area, city, { photos: area.photoCount, documents: area.documentCount });
  return {
    id: area.id,
    code: area.code,
    name: area.name,
    city: area.city,
    neighborhood: area.neighborhood,
    address: area.address,
    kind: area.kind,
    status: area.status,
    lat: area.lat,
    lng: area.lng,
    landAreaM2: area.landAreaM2,
    builtAreaM2: area.builtAreaM2,
    pricePerM2: area.pricePerM2,
    totalPrice: area.totalPrice,
    zoning: area.zoning,
    environmentalRestriction: area.environmentalRestriction,
    score: intel.score,
    grade: intel.grade,
    coverUrl: area.coverUrl,
    photoCount: area.photoCount,
    documentCount: area.documentCount,
    geometry: area.geometry,
    cityData: city ?? null,
    listingUrl: area.listingUrl || null,
  };
}

export function toMapAreas(areas: AreaRecord[], cityMap: Map<string, City>): MapArea[] {
  return areas.map((area) => toMapArea(area, cityMap.get(area.citySlug)));
}
