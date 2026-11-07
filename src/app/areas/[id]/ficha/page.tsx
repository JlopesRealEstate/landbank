import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAreaById, getAreaRestrictions, getTerrainAnalysis } from "@/lib/data";
import { buildMapSnapshot } from "@/lib/map-snapshot";
import { distancesToReferences, REFERENCE_KIND_LABELS, REFERENCE_METHOD, type ReferenceKind } from "@/lib/references";
import { buildIntel } from "@/lib/intelligence";
import { createClient } from "@/lib/supabase/server";
import { ALQUEIRE_PAULISTA_M2, areaLabel, brl, dateLabel, num } from "@/lib/format";
import { BrandMark } from "@/components/ui";
import { TerrainProfileChart } from "@/components/areas/terrain-profile-chart";
import { buildContours } from "@/lib/contour";
import {
  FichaContactBlock,
  FichaMapSketch,
  PhotoMosaic,
  PrintToolbar,
} from "@/components/areas/ficha-export";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getAreaById(Number(id)).catch(() => null);
  return {
    title: result ? `Ficha ${result.area.code} — Land Bank Corp` : "Ficha do imóvel",
  };
}

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const result = await getAreaById(numericId);
  if (!result) notFound();

  const { area, media, city } = result;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const loginContact = {
    name: String(auth.user?.user_metadata?.full_name ?? auth.user?.user_metadata?.name ?? auth.user?.email ?? "Usuário autenticado"),
    phone: String(auth.user?.user_metadata?.phone ?? auth.user?.phone ?? "Telefone não informado"),
    email: auth.user?.email ?? "E-mail não informado",
  };
  const loginPhoneDigits = loginContact.phone.replace(/\\D/g, "");
  const loginWhatsAppPhone = loginPhoneDigits.length === 10 || loginPhoneDigits.length === 11 ? "55" + loginPhoneDigits : loginPhoneDigits;
  const terrain = await getTerrainAnalysis(numericId);
  const restrictions = await getAreaRestrictions(numericId);
  const intel = buildIntel(area, city, { photos: area.photoCount, documents: area.documentCount });
  const photos = media.filter((item) => item.kind === "photo");
  const documents = media.filter((item) => item.kind === "document");
  const stats = terrain?.stats;
  const occupancy = area.landAreaM2 > 0 ? (area.builtAreaM2 / area.landAreaM2) * 100 : 0;
  const restrictedM2 = restrictions.reduce((sum, item) => sum + item.areaM2, 0);
  const restrictedPct = restrictions.reduce((sum, item) => sum + item.lossPct, 0);
  const netArea = Math.max(0, area.landAreaM2 - restrictedM2);
  const netValuePerM2 = netArea > 0 ? Math.round(area.totalPrice / netArea) : 0;
  // curvas para os overlays de impressão (limitadas para manter o PDF leve)
  // Exportação cartográfica em equidistância de 1 m a partir do MDE armazenado.
  // A resolução e a fonte do MDE continuam sendo a limitação real da precisão vertical.
  const fichaContours = terrain?.demGrid
    ? buildContours({
        grid: terrain.demGrid.values,
        bounds: terrain.demGrid.bounds,
        boundary: terrain.demGrid.boundary,
        interval: 1,
        indexInterval: 5,
        minElevation: terrain.demGrid.min,
        maxElevation: terrain.demGrid.max,
      }).filter((contour) => contour.inside !== false)
    : (terrain?.contours ?? []).filter((contour) => contour.inside !== false);
  const referenceDistances = distancesToReferences({ lat: area.lat, lng: area.lng });
  const referenceKinds = [...new Set(referenceDistances.map((item) => item.kind))] as ReferenceKind[];

  // Foto do mapa exatamente na visualização salva (basemap, centro, zoom) + camadas
  const savedView = area.mapView;
  const view = {
    basemap: savedView?.basemap ?? "satelite",
    lat: savedView?.lat ?? area.lat,
    lng: savedView?.lng ?? area.lng,
    zoom: savedView?.zoom ?? 16,
    contourScope: savedView?.contourScope ?? (terrain?.viewConfig?.contourScope ?? "both"),
    heatmapMode: savedView?.heatmapMode ?? terrain?.viewConfig?.heatmapMode ?? "elevation",
    heatmapScope: savedView?.heatmapScope ?? terrain?.viewConfig?.heatmapScope ?? "both",
    heatmapOpacity: savedView?.heatmapOpacity ?? terrain?.viewConfig?.heatmapOpacity ?? 60,
    contours: savedView?.contours ?? terrain?.viewConfig?.showContours ?? true,
    heatmap: savedView?.heatmap ?? true,
  };
  const snapshot = await buildMapSnapshot(view, 900, 470).catch(() => null);
  return (
    <div className="min-h-screen bg-paper-deep print:bg-white">
      <PrintToolbar areaCode={area.code} />

      <main className="ficha mx-auto w-full max-w-[820px] bg-white px-6 py-5 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {/* cabeçalho */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#0b2a35] pb-3">
          <div className="flex items-start gap-2.5">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-[13px] font-semibold tracking-tight text-ink">
                Land Bank Corp<span className="ml-1 font-normal text-muted">| Áreas &amp; Galpões</span>
              </p>
              <p className="text-[8px] uppercase tracking-[0.16em] text-muted">Ficha técnica do imóvel · Sumaré-SP · RMC · Piracicaba</p>
              <p className="mt-1 text-[8px] text-muted">Emitida em {dateLabel(new Date())} · {loginContact.name} · {loginContact.phone} · {loginContact.email}</p>
            </div>
          </div>
          <div className="rounded-lg bg-[#0b2a35] px-2.5 py-1.5 text-right text-white">
            <p className="text-[8px] uppercase tracking-[0.14em] text-white/60">Código</p>
            <p className="text-[13px] font-bold tracking-tight">{area.code}</p>
            <p className="text-[8px] text-[#e9b7c1]">Land Score {intel.score}/100</p>
          </div>
        </header>

        <section className="mt-3">
          <h1 className="text-[16px] font-semibold leading-tight text-ink">{area.name}</h1>
          <p className="mt-0.5 text-[9px] text-muted">
            {[area.address, area.neighborhood, `${area.city} — SP`, area.zipCode].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-2 text-[8px] text-muted">
            <span className="rounded bg-paper px-1.5 py-0.5 font-semibold uppercase tracking-[0.06em] text-ink-soft">
              {area.transaction === "locacao" ? "Locação" : "Venda"}
            </span>
            <span className="rounded bg-paper px-1.5 py-0.5 text-ink-soft">
              {area.kind === "galpao" ? "Galpão / logística" : area.kind === "misto" ? "Uso misto" : "Terreno / gleba"}
            </span>
            <span className="rounded bg-paper px-1.5 py-0.5 text-ink-soft">
              Status: {area.status}
            </span>
            <span className="rounded bg-[#0b2a35] px-1.5 py-0.5 font-semibold text-white">Land Score {intel.score}/100 · {intel.grade}</span>
          </p>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {[
              {
                label: "Área do terreno",
                value: `${num(area.landAreaM2)} m²`,
                hint: `${num(area.landAreaM2 / ALQUEIRE_PAULISTA_M2, 2)} alq · ${num(area.landAreaM2 / 10_000, 2)} ha`,
              },
              { label: "Área construída", value: area.builtAreaM2 ? `${num(area.builtAreaM2)} m²` : "—", hint: `${num(occupancy)}% do terreno` },
              { label: "Valor por m²", value: brl(area.pricePerM2), hint: intel.benchmark > 0 ? `benchmark ${brl(intel.benchmark)}` : "benchmark pendente de aferição" },
              { label: "Valor total", value: brl(area.totalPrice), hint: `${brl(intel.pricePerHa)}/ha` },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-line bg-paper/50 px-2 py-1.5">
                <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p>
                <p className="text-[10px] font-semibold tabular-nums text-ink">{item.value}</p>
                <p className="text-[7px] text-muted">{item.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Descrição do imóvel</p>
            <p className="mt-1 text-justify text-[9px] leading-relaxed text-ink-soft">
              {area.description || "Descrição não informada."}
            </p>
            <div className="mt-2 grid gap-1.5">
              <div className="rounded-md border border-line px-2 py-1.5">
                <p className="text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Zoneamento</p>
                <p className="text-[9px] font-medium text-ink">{area.zoning || "Não informado"}</p>
                <p className="text-[8px] leading-snug text-muted">{area.zoningNotes || "Sem observações."}</p>
              </div>
              <div
                className={`rounded-md border px-2 py-1.5 ${
                  area.environmentalRestriction ? "border-[#e3c2c9] bg-[#f6e8eb]/50" : "border-line bg-leaf-50/40"
                }`}
              >
                <p className="text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Restrição ambiental</p>
                <p className="text-[9px] font-medium text-ink">
                  {area.environmentalRestriction ? "Restrição declarada" : "Sem restrição mapeada"}
                </p>
                <p className="text-[8px] leading-snug text-muted">{area.environmentalNotes || "—"}</p>
              </div>
              <div className="rounded-md border border-line bg-paper/50 px-2 py-1.5">
                <p className="text-[7px] font-semibold uppercase tracking-[0.1em] text-muted">Responsável pelo atendimento</p>
                <p className="text-[9px] font-semibold text-ink">{loginContact.name}</p>
                <p className="text-[8px] text-muted">{loginContact.phone} · {loginContact.email}</p>
              </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Croqui · perímetro KMZ e curvas de nível</p>
            <div className="mt-1">
              <FichaMapSketch
                geometry={area.geometry}
                contours={fichaContours}
                restrictions={restrictions.map((item) => ({ id: item.id, type: item.type, label: item.label || item.type, coordinates: item.coordinates }))}
                heatmap={view.heatmapMode === "cutfill" ? terrain?.cutFillHeatmap ?? null : terrain?.heatmap ?? null}
                snapshot={snapshot}
                showContours={true}
                showHeatmap={false}
                contourScope="inside"
              />
            </div>
            <p className="mt-1 text-[7px] text-muted">
              Coordenadas {area.lat.toFixed(5)}, {area.lng.toFixed(5)} · {area.geometry.length} polígono(s) ·{" "}
              {terrain?.source ?? "sem análise topográfica"} · curvas com equidistância cartográfica de 1 m (interpoladas a partir do MDE) · visualização salva ({view.basemap}, zoom {view.zoom})
            </p>
          </div>
        </section>

        {terrain && stats ? (
          <section className="mt-3 break-inside-avoid rounded-lg border border-line p-2.5">
            <p className="text-[9px] font-semibold text-ink">Perfil altimétrico do terreno</p>
            {stats ? <div className="mt-1 grid grid-cols-4 gap-1.5">
              <div className="rounded bg-paper/70 px-1.5 py-1"><p className="text-[7px] uppercase text-muted">Cota mínima</p><p className="text-[9px] font-semibold text-ink">{num(stats.minElevation, 1)} m</p></div>
              <div className="rounded bg-paper/70 px-1.5 py-1"><p className="text-[7px] uppercase text-muted">Cota máxima</p><p className="text-[9px] font-semibold text-ink">{num(stats.maxElevation, 1)} m</p></div>
              <div className="rounded bg-paper/70 px-1.5 py-1"><p className="text-[7px] uppercase text-muted">Amplitude</p><p className="text-[9px] font-semibold text-ink">{num(stats.rangeM, 1)} m</p></div>
              <div className="rounded bg-paper/70 px-1.5 py-1"><p className="text-[7px] uppercase text-muted">Declividade média</p><p className="text-[9px] font-semibold text-ink">{num(stats.slopePct, 2)}%</p></div>
            </div> : null}
            {terrain?.profile ? <div className="mt-2"><TerrainProfileChart profile={terrain.profile} crossProfile={terrain.crossProfile} height={132} /></div> : <p className="mt-1 text-[8px] text-muted">Perfil altimétrico não disponível.</p>}
            <p className="mt-1 text-[7px] text-muted">Perfil indicativo derivado do modelo digital de elevação. Não constitui projeto ou orçamento de terraplenagem.</p>
          </section>
        ) : null}

        {restrictions.length ? (
          <section className="mt-3 rounded-lg border border-[#e3c2c9] bg-[#f6e8eb]/20 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] font-semibold text-ink">Restrições demarcadas e perda de área</p>
              <p className="text-[8px] text-[#8c2f43]">
                Perda total {num(restrictedPct, 2)}% (somente dentro do KMZ) · área aproveitável {num(netArea)} m² · valor
                sobre área líquida {brl(netValuePerM2)}/m²
              </p>
            </div>
            <table className="mt-1 w-full text-left text-[8px]">
              <thead className="text-[7px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-1 py-0.5 font-semibold">Tipo</th>
                  <th className="px-1 py-0.5 font-semibold">Identificação</th>
                  <th className="px-1 py-0.5 font-semibold">Área</th>
                  <th className="px-1 py-0.5 text-right font-semibold">Perda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3c2c9]/50">
                {restrictions.map((item) => (
                  <tr key={item.id}>
                    <td className="px-1 py-0.5 text-ink-soft">{item.type}</td>
                    <td className="px-1 py-0.5 text-ink-soft">{item.label || "—"}</td>
                    <td className="px-1 py-0.5 tabular-nums">{num(item.areaM2)} m² no KMZ</td>
                    <td className="px-1 py-0.5 text-right font-semibold tabular-nums text-[#8c2f43]">
                      {num(item.lossPct, 2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {restrictions.some((item) => item.notes) ? (
              <p className="mt-1 text-[7px] text-muted">
                {restrictions
                  .filter((item) => item.notes)
                  .map((item) => `${item.type}: ${item.notes}`)
                  .join(" · ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {terrain?.demComparison?.length ? (
          <section className="mt-3">
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Comparativo de fontes topográficas (MDE)</p>
            <table className="mt-1 w-full text-left text-[8px]">
              <thead className="text-[7px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-1 py-0.5 font-semibold">Fonte</th>
                  <th className="px-1 py-0.5 font-semibold">Resolução</th>
                  <th className="px-1 py-0.5 font-semibold">Cota média</th>
                  <th className="px-1 py-0.5 font-semibold">Δ médio</th>
                  <th className="px-1 py-0.5 text-right font-semibold">Concordância</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {terrain.demComparison.map((source) => (
                  <tr key={source.source}>
                    <td className="px-1 py-0.5 text-ink-soft">{source.label}</td>
                    <td className="px-1 py-0.5">{source.resolution}</td>
                    <td className="px-1 py-0.5 tabular-nums">{source.live ? `${num(source.meanElevation, 1)} m` : "—"}</td>
                    <td className="px-1 py-0.5 tabular-nums">{source.live ? `${num(source.meanAbsoluteDiff, 2)} m` : "—"}</td>
                    <td className="px-1 py-0.5 text-right font-semibold tabular-nums">
                      {source.live ? `${num(source.agreementPct, 0)}%` : "offline"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {city ? (
          <section className="mt-3">
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Indicadores IBGE · {city.name}</p>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {[
                { label: "População 2022", value: city.population2022 ? num(city.population2022) : "—" },
                { label: "População 2010", value: city.population2010 ? num(city.population2010) : "—" },
                { label: "Renda média", value: city.avgIncome ? brl(city.avgIncome) : "—" },
                {
                  label: "Salário formal",
                  value:
                    (city.formalMinWages ?? 0) > 0
                      ? `${num(city.formalMinWages ?? 0, 2)} sal. mín. · ${brl(city.formalAvgSalary ?? 0)}`
                      : "—",
                },
                { label: "Renda mediana", value: city.medianIncome ? brl(city.medianIncome) : "—" },
                { label: "IDHM", value: city.idhm ? city.idhm.toFixed(3) : "—" },
                { label: "PIB per capita", value: city.gdpPerCapita ? brl(city.gdpPerCapita) : "—" },
                { label: "Potencial de consumo", value: city.consumptionPotential ? brl(city.consumptionPotential, { compact: true }) : "—" },
                { label: "Benchmark de solo", value: "Pendente de aferição" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-line bg-paper/40 px-1.5 py-1">
                  <p className="text-[7px] font-semibold uppercase tracking-[0.06em] text-muted">{item.label}</p>
                  <p className="text-[9px] font-semibold tabular-nums text-ink">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[7px] text-muted">
              Fonte: IBGE Censo 2022 (população e renda) / CEMPRE 2023 (salário formal em salários mínimos × piso SP de R$ 1.874,36) /
              PIB municipal / PNUD (IDHM). Benchmark de solo Land Bank Corp: pendente de comparáveis auditáveis; valores indicativos anteriores não devem orientar a negociação.
            </p>
          </section>
        ) : null}



        

        {restrictions.length ? (
          <section className="mt-3 rounded-lg border border-[#e3c2c9] bg-[#f6e8eb]/20 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] font-semibold text-ink">Restrições demarcadas e perda de área</p>
              <p className="text-[8px] text-[#8c2f43]">
                Perda total {num(restrictedPct, 2)}% (somente dentro do KMZ) · área aproveitável {num(netArea)} m² · valor
                sobre área líquida {brl(netValuePerM2)}/m²
              </p>
            </div>
            <table className="mt-1 w-full text-left text-[8px]">
              <thead className="text-[7px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-1 py-0.5 font-semibold">Tipo</th>
                  <th className="px-1 py-0.5 font-semibold">Identificação</th>
                  <th className="px-1 py-0.5 font-semibold">Área</th>
                  <th className="px-1 py-0.5 text-right font-semibold">Perda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3c2c9]/50">
                {restrictions.map((item) => (
                  <tr key={item.id}>
                    <td className="px-1 py-0.5 text-ink-soft">{item.type}</td>
                    <td className="px-1 py-0.5 text-ink-soft">{item.label || "—"}</td>
                    <td className="px-1 py-0.5 tabular-nums">{num(item.areaM2)} m² no KMZ</td>
                    <td className="px-1 py-0.5 text-right font-semibold tabular-nums text-[#8c2f43]">
                      {num(item.lossPct, 2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {restrictions.some((item) => item.notes) ? (
              <p className="mt-1 text-[7px] text-muted">
                {restrictions
                  .filter((item) => item.notes)
                  .map((item) => `${item.type}: ${item.notes}`)
                  .join(" · ")}
              </p>
            ) : null}
          </section>
        ) : null}

        {terrain?.demComparison?.length ? (
          <section className="mt-3">
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Comparativo de fontes topográficas (MDE)</p>
            <table className="mt-1 w-full text-left text-[8px]">
              <thead className="text-[7px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-1 py-0.5 font-semibold">Fonte</th>
                  <th className="px-1 py-0.5 font-semibold">Resolução</th>
                  <th className="px-1 py-0.5 font-semibold">Cota média</th>
                  <th className="px-1 py-0.5 font-semibold">Δ médio</th>
                  <th className="px-1 py-0.5 text-right font-semibold">Concordância</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {terrain.demComparison.map((source) => (
                  <tr key={source.source}>
                    <td className="px-1 py-0.5 text-ink-soft">{source.label}</td>
                    <td className="px-1 py-0.5">{source.resolution}</td>
                    <td className="px-1 py-0.5 tabular-nums">{source.live ? `${num(source.meanElevation, 1)} m` : "—"}</td>
                    <td className="px-1 py-0.5 tabular-nums">{source.live ? `${num(source.meanAbsoluteDiff, 2)} m` : "—"}</td>
                    <td className="px-1 py-0.5 text-right font-semibold tabular-nums">
                      {source.live ? `${num(source.agreementPct, 0)}%` : "offline"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {city ? (
          <section className="mt-3">
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Indicadores IBGE · {city.name}</p>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {[
                { label: "População 2022", value: city.population2022 ? num(city.population2022) : "—" },
                { label: "População 2010", value: city.population2010 ? num(city.population2010) : "—" },
                { label: "Renda média", value: city.avgIncome ? brl(city.avgIncome) : "—" },
                {
                  label: "Salário formal",
                  value:
                    (city.formalMinWages ?? 0) > 0
                      ? `${num(city.formalMinWages ?? 0, 2)} sal. mín. · ${brl(city.formalAvgSalary ?? 0)}`
                      : "—",
                },
                { label: "Renda mediana", value: city.medianIncome ? brl(city.medianIncome) : "—" },
                { label: "IDHM", value: city.idhm ? city.idhm.toFixed(3) : "—" },
                { label: "PIB per capita", value: city.gdpPerCapita ? brl(city.gdpPerCapita) : "—" },
                { label: "Potencial de consumo", value: city.consumptionPotential ? brl(city.consumptionPotential, { compact: true }) : "—" },
                { label: "Benchmark de solo", value: city.marketPriceM2 ? `${brl(city.marketPriceM2)}/m²` : "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-line bg-paper/40 px-1.5 py-1">
                  <p className="text-[7px] font-semibold uppercase tracking-[0.06em] text-muted">{item.label}</p>
                  <p className="text-[9px] font-semibold tabular-nums text-ink">{item.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[7px] text-muted">
              Fonte: IBGE Censo 2022 (população e renda) / CEMPRE 2023 (salário formal em salários mínimos × piso SP de R$ 1.874,36) /
              PIB municipal / PNUD (IDHM). Benchmark de solo Land Bank Corp:{" "}
              {city.marketPriceM2 ? `${brl(city.marketPriceM2)}/m²` : "em atualização"}.
            </p>
          </section>
        ) : null}



        <section className="mt-3 break-inside-avoid">
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
            Distâncias estratégicas — geometria real até o eixo/acesso
          </p>
          <div className="mt-1 space-y-1">
            {referenceKinds.map((kind) => (
              <div key={kind}>
                <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-[#8c2f43]">
                  {REFERENCE_KIND_LABELS[kind]}
                </p>
                <div className="grid grid-cols-3 gap-x-3">
                  {referenceDistances
                    .filter((item) => item.kind === kind)
                    .sort((first, second) => first.km - second.km)
                    .map((item) => (
                      <div key={item.id} className="flex items-baseline justify-between gap-1 border-b border-dashed border-line/70 py-0.5">
                        <span className="truncate text-[7.5px] text-ink-soft">{item.short}</span>
                        <span className="shrink-0 text-[7.5px] font-semibold tabular-nums text-ink">{num(item.km, 1)} km</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-0.5 text-[6.5px] leading-snug text-muted">{REFERENCE_METHOD}</p>
        </section>

        <section className="mt-3 break-inside-avoid">
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
            Inteligência · pilares do Land Score e logística
          </p>
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {intel.pillars.map((pillar) => (
              <div key={pillar.key} className="rounded border border-line bg-paper/40 px-1.5 py-1">
                <p className="flex items-center justify-between text-[7px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {pillar.label} <span className="text-ink">{pillar.score}</span>
                </p>
                <p className="text-[7.5px] leading-snug text-ink-soft">{pillar.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {[
              { label: "Até Sumaré", value: `${num(intel.distances.sumare, 1)} km` },
              { label: "Até Campinas", value: `${num(intel.distances.campinas, 1)} km` },
              { label: "Até Viracopos", value: `${num(intel.distances.viracopos, 1)} km` },
              { label: "Até Piracicaba", value: `${num(intel.distances.piracicaba, 1)} km` },
            ].map((item) => (
              <div key={item.label} className="rounded border border-line px-1.5 py-1">
                <p className="text-[7px] font-semibold uppercase tracking-[0.06em] text-muted">{item.label}</p>
                <p className="text-[8px] font-semibold tabular-nums text-ink">{item.value}</p>
              </div>
            ))}
          </div>
          <ul className="mt-1 space-y-0.5">
            {intel.insights.map((insight) => (
              <li key={insight} className="text-[7.5px] leading-snug text-ink-soft">
                • {insight}
              </li>
            ))}
          </ul>
          {area.description ? (
            <p className="mt-1 text-justify text-[8px] leading-relaxed text-ink-soft">{area.description}</p>
          ) : null}
        </section>

        <section className="mt-3 break-inside-avoid">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-[#e3c2c9] bg-[#f6e8eb]/30 px-2 py-1.5">
              <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8c2f43]">
                Pendências e riscos ({intel.alerts.length})
              </p>
              {intel.alerts.length ? (
                <ul className="mt-0.5 space-y-0.5">
                  {intel.alerts.map((alert) => (
                    <li key={alert} className="text-[7.5px] leading-snug text-ink-soft">
                      • {alert}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-[7.5px] text-leaf-600">Dossiê completo, sem pendências identificadas.</p>
              )}
            </div>
            <div className="rounded border border-line bg-paper/40 px-2 py-1.5">
              <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Vocação econômica e acessos</p>
              <p className="mt-0.5 text-[7.5px] leading-snug text-ink-soft">
                {city?.topSectors || "Vocação econômica em detalhamento pelo time de inteligência."}
              </p>
              {city?.highlights?.length ? (
                <ul className="mt-0.5 space-y-0.5">
                  {city.highlights.map((highlight) => (
                    <li key={highlight.label} className="text-[7.5px] leading-snug text-muted">
                      <strong className="text-ink-soft">{highlight.label}:</strong> {highlight.value}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-[7px] text-muted">
                Visualização salva do mapa: {view.basemap} · zoom {view.zoom} · curvas {view.contours ? "sim" : "não"} ·
                calor {view.heatmap ? view.heatmapMode === "cutfill" ? "corte/aterro" : "cotas" : "não"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-3 break-inside-avoid">
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Dossiê digital</p>
          <div className="mt-1 grid grid-cols-4 gap-1.5">
            {[
              { label: "Fotos", value: num(photos.length) },
              { label: "Documentos", value: num(documents.length) },
              { label: "KMZ", value: area.kmzFileName ? "anexado" : "—" },
              { label: "Apresentação", value: `/apresentacao/${area.code}` },
            ].map((item) => (
              <div key={item.label} className="rounded border border-line px-1.5 py-1">
                <p className="text-[7px] font-semibold uppercase tracking-[0.06em] text-muted">{item.label}</p>
                <p className="truncate text-[7.5px] font-semibold text-ink">{item.value}</p>
              </div>
            ))}
          </div>
          {documents.length ? (
            <table className="mt-1 w-full text-left text-[7.5px]">
              <thead className="text-[7px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="px-1 py-0.5 font-semibold">Documento</th>
                  <th className="px-1 py-0.5 font-semibold">Categoria</th>
                  <th className="px-1 py-0.5 font-semibold">Tamanho</th>
                  <th className="px-1 py-0.5 text-right font-semibold">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="max-w-[220px] truncate px-1 py-0.5 text-ink-soft">{document.name}</td>
                    <td className="px-1 py-0.5 text-muted">{document.category}</td>
                    <td className="px-1 py-0.5 tabular-nums text-muted">{Math.max(1, Math.round(document.size / 1024))} KB</td>
                    <td className="px-1 py-0.5 text-right text-muted">{dateLabel(document.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>

        <section className="mt-3 page-break">
          <div className="flex items-center justify-between">
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
              Fotos · mosaico ({photos.length})
            </p>
            <p className="text-[7px] text-muted">Imagens reduzidas para impressão em A4 retrato</p>
          </div>
          <div className="mt-1">
            <PhotoMosaic photos={photos.map((photo) => ({ id: photo.id, url: photo.url, name: photo.name, category: photo.category }))} />
            <p className="mt-1 text-[7px] text-muted">
              {photos.length} foto(s) no dossiê · categorias: {[...new Set(photos.map((photo) => photo.category))].join(", ") || "—"}
            </p>
          </div>
        </section>

        <section className="mt-3">
          <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
            Documentos do dossiê ({documents.length})
          </p>
          <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
            {documents.map((document) => (
              <li key={document.id} className="flex items-baseline justify-between gap-1 border-b border-dashed border-line py-0.5 text-[8px]">
                <span className="truncate text-ink-soft">{document.name}</span>
                <span className="shrink-0 uppercase tracking-[0.06em] text-muted">{document.category}</span>
              </li>
            ))}
            {documents.length === 0 ? <li className="text-[8px] text-muted">Nenhum documento anexado.</li> : null}
          </ul>
        </section>

        <footer className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-2">
          <FichaContactBlock contact={loginContact} />
          <div className="text-[7px] leading-relaxed text-muted">
            <p className="font-semibold uppercase tracking-[0.1em] text-ink-soft">Falar com o consultor</p>
            <p className="mt-0.5 text-[8px] text-ink">
              {loginWhatsAppPhone ? <a href={`https://wa.me/${loginWhatsAppPhone}?text=${encodeURIComponent(`Tenho interesse no ativo ${area.code} — ${area.name}`)}`} className="font-semibold text-[#8c2f43]">WhatsApp {loginContact.phone}</a> : <span>{loginContact.phone}</span>}
              {" "}· <a href={`mailto:${loginContact.email}`} className="text-leaf-600">{loginContact.email}</a>
            </p>
            <p className="mt-1 font-semibold uppercase tracking-[0.1em] text-ink-soft">Observações</p>
            <p className="mt-0.5">
              Documento gerado pelo CRM Land Bank Corp. Áreas e perímetros calculados por coordenadas geodésicas; valores
              sujeitos a confirmação documental e laudo de avaliação. Análise topográfica baseada em SRTM 30 m — não
              substitui levantamento planialtimétrico. Contato do usuário emissor: {loginContact.name} · {loginContact.phone} · {loginContact.email}.
            </p>
            <Link href="/" className="mt-1 inline-block font-medium text-leaf-600">
              landbankcorp.com.br
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
