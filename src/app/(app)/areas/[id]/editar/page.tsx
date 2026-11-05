import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAreaById, getCityOptions } from "@/lib/data";
import { Eyebrow } from "@/components/ui";
import { AreaForm, type AreaFormInitial } from "@/components/areas/area-form";

export const dynamic = "force-dynamic";

export default async function EditAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const [result, cities] = await Promise.all([getAreaById(numericId), getCityOptions()]);
  if (!result) notFound();

  const { area } = result;
  const initial: AreaFormInitial = {
    id: area.id,
    code: area.code,
    name: area.name,
    kind: area.kind,
    status: area.status,
    description: area.description,
    city: area.city,
    citySlug: area.citySlug,
    neighborhood: area.neighborhood,
    address: area.address,
    zipCode: area.zipCode,
    lat: area.lat,
    lng: area.lng,
    landAreaM2: area.landAreaM2,
    builtAreaM2: area.builtAreaM2,
    pricePerM2: area.pricePerM2,
    totalPrice: area.totalPrice,
    zoning: area.zoning,
    zoningNotes: area.zoningNotes,
    environmentalRestriction: area.environmentalRestriction,
    environmentalNotes: area.environmentalNotes,
    ownerName: area.ownerName,
    contactName: area.contactName,
    contactPhone: area.contactPhone,
    contactEmail: area.contactEmail,
    featured: area.featured,
    geometry: area.geometry,
    kmzFileName: area.kmzFileName,
    transaction: area.transaction,
    partnerName: area.partnerName,
    partnerPhone: area.partnerPhone,
    listingUrl: area.listingUrl,
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/areas/${area.id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o dossiê
        </Link>
        <Eyebrow className="mt-3">Edição · {area.code}</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Editar {area.name}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Atualize dados do imóvel, metragens, valores, zoneamento, restrições e o perímetro KMZ.
        </p>
      </div>
      <AreaForm
        mode="edit"
        initial={initial}
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
