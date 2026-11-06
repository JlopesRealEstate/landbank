import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAreaByCode, getTerrainAnalysis } from "@/lib/data";
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
  const terrain = await getTerrainAnalysis(area.id);
  const mapArea = toMapArea(area, city);
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
      media={media.map((item) => ({
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
