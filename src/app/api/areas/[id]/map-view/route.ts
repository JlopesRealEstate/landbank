import { eq } from "drizzle-orm";
import { db } from "@/db";
import { areas } from "@/db/schema";
import type { MapViewConfig } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const BASEMAPS = new Set(["mapa", "satelite", "humanitario"]);

export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const areaId = Number(id);
    if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Partial<MapViewConfig>;
    const [existing] = await db.select({ mapView: areas.mapView, lat: areas.lat, lng: areas.lng }).from(areas).where(eq(areas.id, areaId)).limit(1);
    if (!existing) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const mapView: MapViewConfig = {
      basemap: BASEMAPS.has(String(body.basemap)) ? String(body.basemap) : existing.mapView?.basemap ?? "satelite",
      lat: Number.isFinite(lat) ? lat : existing.mapView?.lat ?? existing.lat,
      lng: Number.isFinite(lng) ? lng : existing.mapView?.lng ?? existing.lng,
      zoom: Math.min(19, Math.max(6, Math.round(Number(body.zoom) || existing.mapView?.zoom || 16))),
      contourScope: body.contourScope ?? existing.mapView?.contourScope ?? "both",
      heatmapMode: body.heatmapMode ?? existing.mapView?.heatmapMode ?? "elevation",
      heatmapScope: body.heatmapScope ?? existing.mapView?.heatmapScope ?? "both",
      heatmapOpacity: Math.min(100, Math.max(5, Number(body.heatmapOpacity ?? existing.mapView?.heatmapOpacity ?? 60))),
      contours: body.contours ?? existing.mapView?.contours ?? true,
      heatmap: body.heatmap ?? existing.mapView?.heatmap ?? true,
    };

    await db.update(areas).set({ mapView }).where(eq(areas.id, areaId));
    return Response.json({ ok: true, mapView });
  } catch (error) {
    console.error("[map-view:PATCH]", error);
    return Response.json({ ok: false, error: "Não foi possível salvar a visualização." }, { status: 500 });
  }
}
