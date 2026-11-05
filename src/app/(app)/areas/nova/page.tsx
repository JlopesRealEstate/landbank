import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCityOptions } from "@/lib/data";
import { Eyebrow } from "@/components/ui";
import { AreaForm } from "@/components/areas/area-form";

export const dynamic = "force-dynamic";

export default async function NewAreaPage() {
  const cities = await getCityOptions();
  return (
    <div className="space-y-5">
      <div>
        <Link href="/areas" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para áreas
        </Link>
        <Eyebrow className="mt-3">Novo cadastro</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Cadastrar área ou galpão</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Cadastro completo com importação de KMZ, vínculo automático dos indicadores IBGE do município, fotos, documentos
          e perímetro no mapa interativo.
        </p>
      </div>
      <AreaForm
        mode="create"
        cities={cities.map((city) => ({
          slug: city.slug,
          name: city.name,
          region: city.region,
          population2022: city.population2022,
          avgIncome: city.avgIncome,
          idhm: city.idhm,
          marketPriceM2: city.marketPriceM2,
          gdpPerCapita: city.gdpPerCapita,
          areaKm2: city.areaKm2,
          lat: city.lat,
          lng: city.lng,
          hasIndicators: city.population2022 > 0,
        }))}
      />
    </div>
  );
}
