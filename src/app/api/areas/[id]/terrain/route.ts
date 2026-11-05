import { eq } from "drizzle-orm";
import { db } from "@/db";
import { terrainAnalyses } from "@/db/schema";
import { ensureDatabase } from "@/db/bootstrap";
import { getAreaById, logActivity } from "@/lib/data";
import { analyzeTerrain } from "@/lib/terrain";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const areaId = Number(id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  await ensureDatabase();
  const [row] = await db.select().from(terrainAnalyses).where(eq(terrainAnalyses.areaId, areaId)).limit(1);
  if (!row) return Response.json({ ok: true, analysis: null });
  return Response.json({ ok: true, analysis: row });
}

export async function POST(request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const areaId = Number(id);
    if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const result = await getAreaById(areaId);
    if (!result) return Response.json({ ok: false, error: "Imóvel não encontrado." }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      interval?: number;
      bufferM?: number;
      targetMode?: "mean" | "min" | "max" | "manual";
      targetElevation?: number;
      resolution?: number;
      demSource?: string;
      verticalOffset?: number;
      viewConfig?: {
        contourScope?: "both" | "inside" | "around";
        showContours?: boolean;
        heatmapMode?: "elevation" | "cutfill";
        heatmapScope?: "both" | "inside" | "around";
        heatmapOpacity?: number;
      };
    };
    const interval = Math.min(50, Math.max(0.5, Number(body.interval) || 0.5));
    const bufferM = Math.min(1500, Math.max(10, Number(body.bufferM) || 200));
    const targetMode = ["balance", "mean", "min", "max", "manual"].includes(String(body.targetMode))
      ? (body.targetMode as "balance" | "mean" | "min" | "max" | "manual")
      : "balance";
    const targetElevation = Number.isFinite(Number(body.targetElevation)) ? Number(body.targetElevation) : undefined;
    const resolution = Math.min(48, Math.max(16, Math.round(Number(body.resolution) || 30)));
    const viewConfig = {
      // padrão ao gerar: exibir curvas e mapa de calor DENTRO do KMZ
      contourScope: (["both", "inside", "around"].includes(String(body.viewConfig?.contourScope))
        ? body.viewConfig?.contourScope
        : "inside") as "both" | "inside" | "around",
      showContours: body.viewConfig?.showContours ?? true,
      heatmapMode: (body.viewConfig?.heatmapMode === "cutfill" ? "cutfill" : "elevation") as "elevation" | "cutfill",
      heatmapScope: (["both", "inside", "around"].includes(String(body.viewConfig?.heatmapScope))
        ? body.viewConfig?.heatmapScope
        : "inside") as "both" | "inside" | "around",
      heatmapOpacity: Math.min(100, Math.max(5, Number(body.viewConfig?.heatmapOpacity) || 60)),
    };

    const analysis = await analyzeTerrain(
      result.area.geometry,
      { lat: result.area.lat, lng: result.area.lng },
      {
        interval,
        bufferM,
        targetMode,
        targetElevation,
        resolution,
        demSource: ["srtm30m", "copernicus", "aster30m"].includes(String(body.demSource)) ? body.demSource : "srtm30m",
        verticalOffset: Number.isFinite(Number(body.verticalOffset)) ? Number(body.verticalOffset) : 0,
      },
    );

    const [saved] = await db
      .insert(terrainAnalyses)
      .values({
        areaId,
        interval: analysis.effectiveInterval,
        bufferM,
        source: analysis.source,
        resolution: analysis.resolution,
        viewConfig,
        scope: viewConfig.contourScope,
        targetMode,
        demSource: ["srtm30m", "copernicus", "aster30m"].includes(String(body.demSource)) ? String(body.demSource) : "srtm30m",
        verticalOffset: Number.isFinite(Number(body.verticalOffset)) ? Number(body.verticalOffset) : 0,
        targetElevation: analysis.grading.targetElevation,
        contours: analysis.contours,
        stats: analysis.stats,
        heatmap: analysis.heatmap,
        cutFillHeatmap: analysis.cutFillHeatmap,
        profile: analysis.profile,
        crossProfile: analysis.crossProfile,
        demComparison: analysis.demComparison,
        gridLines: analysis.gridLines,
        gridInfo: analysis.gridInfo,
        demGrid: analysis.demGrid,
        grading: analysis.grading,
      })
      .onConflictDoUpdate({
        target: terrainAnalyses.areaId,
        set: {
          interval: analysis.effectiveInterval,
          bufferM,
          source: analysis.source,
          resolution: analysis.resolution,
          viewConfig,
          scope: viewConfig.contourScope,
          targetMode,
          demSource: ["srtm30m", "copernicus", "aster30m"].includes(String(body.demSource)) ? String(body.demSource) : "srtm30m",
          verticalOffset: Number.isFinite(Number(body.verticalOffset)) ? Number(body.verticalOffset) : 0,
          targetElevation: analysis.grading.targetElevation,
          contours: analysis.contours,
          stats: analysis.stats,
          heatmap: analysis.heatmap,
          cutFillHeatmap: analysis.cutFillHeatmap,
          profile: analysis.profile,
          crossProfile: analysis.crossProfile,
          demComparison: analysis.demComparison,
          gridLines: analysis.gridLines,
          gridInfo: analysis.gridInfo,
          demGrid: analysis.demGrid,
          grading: analysis.grading,
          createdAt: new Date(),
        },
      })
      .returning();

    await logActivity(
      areaId,
      "terrain",
      "Curvas de nível geradas",
      `${analysis.stats.contourCount} curvas (${analysis.stats.insideContours} dentro do KMZ) · cotas ${analysis.stats.minElevation}–${analysis.stats.maxElevation} m · terraplenagem estimada em R$ ${analysis.grading.totalCost.toLocaleString("pt-BR")}`,
    );

    return Response.json({ ok: true, analysis: saved });
  } catch (error) {
    console.error("[terrain:POST]", error);
    return Response.json({ ok: false, error: "Não foi possível gerar as curvas de nível." }, { status: 500 });
  }
}

/** Salva apenas a configuração de exibição (sem reprocessar a análise). */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureDatabase();
    const { id } = await params;
    const areaId = Number(id);
    if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as {
      contourScope?: "both" | "inside" | "around";
      showContours?: boolean;
      heatmapMode?: "elevation" | "cutfill";
      heatmapScope?: "both" | "inside" | "around";
      heatmapOpacity?: number;
    };

    const [existing] = await db.select().from(terrainAnalyses).where(eq(terrainAnalyses.areaId, areaId)).limit(1);
    if (!existing) return Response.json({ ok: false, error: "Nenhuma análise para salvar configuração." }, { status: 404 });

    const viewConfig = {
      contourScope: (["both", "inside", "around"].includes(String(body.contourScope))
        ? body.contourScope
        : existing.viewConfig?.contourScope ?? "both") as "both" | "inside" | "around",
      showContours: body.showContours ?? existing.viewConfig?.showContours ?? true,
      heatmapMode: (body.heatmapMode === "cutfill"
        ? "cutfill"
        : body.heatmapMode === "elevation"
          ? "elevation"
          : existing.viewConfig?.heatmapMode ?? "elevation") as "elevation" | "cutfill",
      heatmapScope: (["both", "inside", "around"].includes(String(body.heatmapScope))
        ? body.heatmapScope
        : existing.viewConfig?.heatmapScope ?? "both") as "both" | "inside" | "around",
      heatmapOpacity: Math.min(100, Math.max(5, Number(body.heatmapOpacity ?? existing.viewConfig?.heatmapOpacity ?? 60))),
    };

    const [saved] = await db
      .update(terrainAnalyses)
      .set({ viewConfig, scope: viewConfig.contourScope })
      .where(eq(terrainAnalyses.areaId, areaId))
      .returning();

    return Response.json({ ok: true, analysis: saved });
  } catch (error) {
    console.error("[terrain:PATCH]", error);
    return Response.json({ ok: false, error: "Não foi possível salvar a configuração." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  await ensureDatabase();
  const { id } = await params;
  const areaId = Number(id);
  if (!Number.isInteger(areaId)) return Response.json({ ok: false, error: "ID inválido." }, { status: 400 });
  await db.delete(terrainAnalyses).where(eq(terrainAnalyses.areaId, areaId));
  return Response.json({ ok: true });
}
