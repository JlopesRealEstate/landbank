import Link from "next/link";
import { Plus } from "lucide-react";
import { getPortfolio } from "@/lib/data";
import { toMapAreas } from "@/lib/map-data";
import { areaLabel, brl, num } from "@/lib/format";
import { Card, EmptyState, Eyebrow } from "@/components/ui";
import { AreaDirectory } from "@/components/areas/area-directory";

export const dynamic = "force-dynamic";

export default async function AreasPage() {
  let portfolio: Awaited<ReturnType<typeof getPortfolio>> | null = null;
  try {
    portfolio = await getPortfolio();
  } catch (error) {
    console.error("[areas]", error);
  }

  if (!portfolio) {
    return <Card className="p-6 text-sm text-muted">Base indisponível. Recarregue a aplicação.</Card>;
  }

  const mapAreas = toMapAreas(portfolio.areas, portfolio.cityMap);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Cadastro completo</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Áreas &amp; Galpões</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {portfolio.summary.totalAreas} ativos em {portfolio.summary.citiesCount} municípios ·{" "}
            {areaLabel(portfolio.summary.totalLandM2)} de terreno e {num(portfolio.summary.totalBuiltM2)} m² construídos ·{" "}
            {brl(portfolio.summary.vgv, { compact: true })} em VGV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/mapa" className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-medium hover:border-leaf hover:text-leaf-600">
            Visualizar no mapa
          </Link>
          <Link href="/areas/nova" className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-forest-600">
            <Plus className="h-3.5 w-3.5 text-[#e9b7c1]" /> Nova área / importar KMZ
          </Link>
        </div>
      </div>

      {mapAreas.length === 0 ? (
        <EmptyState
          title="Nenhuma área cadastrada"
          description="Cadastre a primeira área ou importe um KMZ para gerar o ponto e o perímetro no mapa."
          action={
            <Link href="/areas/nova" className="rounded-lg bg-forest px-3 py-2 text-xs font-medium text-white">
              Cadastrar área
            </Link>
          }
        />
      ) : (
        <AreaDirectory areas={mapAreas} />
      )}
    </div>
  );
}
