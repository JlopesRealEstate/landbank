import { notFound } from "next/navigation";
import { getAreaById, getAreaRestrictions, getAreas, getTerrainAnalysis } from "@/lib/data";
import { buildIntel } from "@/lib/intelligence";
import { toMapArea } from "@/lib/map-data";
import { AreaDetail, type DetailArea } from "@/components/areas/area-detail";

export const dynamic = "force-dynamic";

export default async function AreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const result = await getAreaById(numericId);
  if (!result) notFound();
  const terrain = await getTerrainAnalysis(numericId);
  const restrictions = await getAreaRestrictions(numericId);
  const allAreas = await getAreas();
  const index = allAreas.findIndex((item) => item.id === numericId);
  const navigation = {
    previous: index > 0 ? { id: allAreas[index - 1].id, code: allAreas[index - 1].code, name: allAreas[index - 1].name } : null,
    next:
      index >= 0 && index < allAreas.length - 1
        ? { id: allAreas[index + 1].id, code: allAreas[index + 1].code, name: allAreas[index + 1].name }
        : null,
    position: index + 1,
    total: allAreas.length,
  };

  const { area, media, activities, city } = result;
  const mapArea = toMapArea(area, city);
  const intel = buildIntel(area, city, { photos: area.photoCount, documents: area.documentCount });

  const detail: DetailArea = {
    ...mapArea,
    description: area.description,
    zoningNotes: area.zoningNotes,
    environmentalNotes: area.environmentalNotes,
    ownerName: area.ownerName,
    contactName: area.contactName,
    contactPhone: area.contactPhone,
    contactEmail: area.contactEmail,
    kmzFileName: area.kmzFileName,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
    featured: area.featured,
    zipCode: area.zipCode,
    citySlug: area.citySlug,
    transaction: area.transaction,
    partnerName: area.partnerName,
    partnerPhone: area.partnerPhone,
    listingUrl: area.listingUrl,
  };

  return (
    <AreaDetail
      area={detail}
      intel={intel}
      media={media.map((item) => ({
        id: item.id,
        kind: item.kind,
        category: item.category,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        url: item.url,
        createdAt: item.createdAt.toISOString(),
      }))}
      initialTerrain={
        terrain
          ? {
              id: terrain.id,
              areaId: terrain.areaId,
              interval: terrain.interval,
              bufferM: terrain.bufferM,
              resolution: terrain.resolution,
              demSource: terrain.demSource,
              verticalOffset: terrain.verticalOffset,
              viewConfig: terrain.viewConfig,
              source: terrain.source,
              scope: terrain.scope,
              targetMode: terrain.targetMode,
              targetElevation: terrain.targetElevation,
              contours: terrain.contours,
              stats: terrain.stats,
              heatmap: terrain.heatmap,
              cutFillHeatmap: terrain.cutFillHeatmap,
              profile: terrain.profile,
              crossProfile: terrain.crossProfile,
              demComparison: terrain.demComparison,
              gridLines: terrain.gridLines,
              gridInfo: terrain.gridInfo,
              demGrid: terrain.demGrid,
              grading: terrain.grading,
              createdAt: terrain.createdAt.toISOString(),
            }
          : null
      }
      navigation={navigation}
      initialRestrictions={restrictions.map((item) => ({
        id: item.id,
        type: item.type,
        label: item.label,
        notes: item.notes,
        coordinates: item.coordinates,
        areaM2: item.areaM2,
        lossPct: item.lossPct,
      }))}
      activities={activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        title: activity.title,
        detail: activity.detail,
        createdAt: activity.createdAt.toISOString(),
      }))}
    />
  );
}
