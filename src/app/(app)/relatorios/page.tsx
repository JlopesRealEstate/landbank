import { getPortfolio } from "@/lib/data";
import { db } from "@/db";
import { areaRestrictions, terrainAnalyses } from "@/db/schema";
import { sql } from "drizzle-orm";
import { buildIntel } from "@/lib/intelligence";
import { Eyebrow } from "@/components/ui";
import { ReportsView, type ReportArea } from "@/components/reports/reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const portfolio = await getPortfolio();

  const scores: Record<number, number> = {};
  for (const area of portfolio.areas) {
    scores[area.id] = buildIntel(area, portfolio.cityMap.get(area.citySlug), {
      photos: area.photoCount,
      documents: area.documentCount,
    }).score;
  }

  const [restrictionRows, terrainRows] = await Promise.all([
    db
      .select({
        areaId: areaRestrictions.areaId,
        count: sql<number>`count(*)::int`,
        areaM2: sql<number>`coalesce(sum(${areaRestrictions.areaM2}), 0)::float`,
        lossPct: sql<number>`coalesce(sum(${areaRestrictions.lossPct}), 0)::float`,
      })
      .from(areaRestrictions)
      .groupBy(areaRestrictions.areaId),
    db
      .select({
        areaId: terrainAnalyses.areaId,
        stats: terrainAnalyses.stats,
        grading: terrainAnalyses.grading,
      })
      .from(terrainAnalyses),
  ]);
  const restrictionMap = new Map(restrictionRows.map((row) => [row.areaId, row]));
  const terrainMap = new Map(terrainRows.map((row) => [row.areaId, row]));

  const areas: ReportArea[] = portfolio.areas.map((area) => ({
    id: area.id,
    code: area.code,
    name: area.name,
    city: area.city,
    neighborhood: area.neighborhood,
    kind: area.kind,
    status: area.status,
    landAreaM2: area.landAreaM2,
    builtAreaM2: area.builtAreaM2,
    pricePerM2: area.pricePerM2,
    totalPrice: area.totalPrice,
    environmentalRestriction: area.environmentalRestriction,
    zoning: area.zoning,
    photoCount: area.photoCount,
    documentCount: area.documentCount,
    createdAt: area.createdAt,
    transaction: area.transaction,
    lat: area.lat,
    lng: area.lng,
    partnerName: area.partnerName,
    partnerPhone: area.partnerPhone,
    ownerName: area.ownerName,
    address: area.address,
    environmentalNotes: area.environmentalNotes,
    zoningNotes: area.zoningNotes,
    restrictionsCount: restrictionMap.get(area.id)?.count ?? 0,
    restrictedAreaM2: restrictionMap.get(area.id)?.areaM2 ?? 0,
    restrictedLossPct: restrictionMap.get(area.id)?.lossPct ?? 0,
    score: scores[area.id] ?? 0,
    terrainSummary: terrainMap.get(area.id)?.grading
      ? {
          minElevation: terrainMap.get(area.id)!.stats.minElevation,
          maxElevation: terrainMap.get(area.id)!.stats.maxElevation,
          cutVolumeM3: terrainMap.get(area.id)!.grading!.cutVolumeM3,
          fillVolumeM3: terrainMap.get(area.id)!.grading!.fillVolumeM3,
          totalCost: terrainMap.get(area.id)!.grading!.totalCost,
        }
      : null,
  }));

  const generatedAt = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-5">
      <div className="no-print">
        <Eyebrow>Business intelligence</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Relatórios</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Relatórios gerenciais do portfólio ativo com KPIs, gráficos e relação completa de imóveis. Exporte em PDF com o
          mesmo design da tela — imóveis vendidos e cancelados ficam fora dos relatórios, disponíveis apenas em Consultas.
        </p>
      </div>
      <ReportsView areas={areas} summary={portfolio.summary} scores={scores} generatedAt={generatedAt} />
    </div>
  );
}
