import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAreaByCode, getAreaRestrictions, getTerrainAnalysis } from "@/lib/data";
import { buildMapSnapshot } from "@/lib/map-snapshot";
import { buildIntel } from "@/lib/intelligence";
import { toMapArea } from "@/lib/map-data";
import { PresentationView } from "@/components/presentation/presentation-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const result = await getAreaByCode(decodeURIComponent(code)).catch(() => null);
  if (!result) return { title: "Land Bank Corp | Áreas & Galpões" };
  return {
    title: `${result.area.code} · ${result.area.name} | Land Bank Corp`,
    description: result.area.description.slice(0, 160),
  };
}

export default async function PresentationPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await getAreaByCode(decodeURIComponent(code));
  if (!result) notFound();

  const { area, media, city } = result;
  const [terrain, restrictions] = await Promise.all([getTerrainAnalysis(area.id), getAreaRestrictions(area.id)]);
  const mapArea = toMapArea(area, city);
  const savedView = area.mapView;
  const mapSnapshot = await buildMapSnapshot({
    basemap: savedView?.basemap ?? "satelite",
    lat: savedView?.lat ?? area.lat,
    lng: savedView?.lng ?? area.lng,
    zoom: savedView?.zoom ?? 16,
    contourScope: savedView?.contourScope ?? "inside",
    heatmapMode: savedView?.heatmapMode ?? "elevation",
    heatmapScope: savedView?.heatmapScope ?? "inside",
    heatmapOpacity: savedView?.heatmapOpacity ?? 60,
    contours: true,
    heatmap: false,
  }, 900, 470).catch(() => null);
  const intel = buildIntel(area, city, { photos: area.photoCount, documents: area.documentCount });

  return (
    <PresentationView
      area={{
        ...mapArea,
        description: area.description,
        zoningNotes: area.zoningNotes,
        environmentalNotes: area.environmentalNotes,
        contactName: area.contactName,
        contactPhone: area.contactPhone,
        contactEmail: area.contactEmail,
      }}
      intel={intel}
      city={city}
      contours={(terrain?.contours ?? []).filter((contour) => contour.inside !== false)}
      elevationRange={
        terrain?.stats ? { min: terrain.stats.minElevation, max: terrain.stats.maxElevation } : null
      }
      snapshot={mapSnapshot}
      restrictions={restrictions.map((item) => ({ id: item.id, type: item.type, label: item.label || item.type, coordinates: item.coordinates }))}
      media={media.filter((item) => item.kind === "photo").map((item) => ({
        id: item.id,
        kind: item.kind,
        category: item.category,
        name: item.name,
        size: item.size,
        url: item.url,
      }))}
    />
  );
}
