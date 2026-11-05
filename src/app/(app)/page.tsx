import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  ArrowUpRight,
  Building2,
  Layers,
  MapPinned,
  Plus,
  Ruler,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getPortfolio } from "@/lib/data";
import { buildIntel } from "@/lib/intelligence";
import { toMapAreas } from "@/lib/map-data";
import { ALQUEIRE_PAULISTA_M2, areaLabel, brl, dateLabel, num, percent } from "@/lib/format";
import { Bar, Card, EmptyState, Eyebrow, KindBadge, ScorePill, SectionTitle, Stat, StatusBadge } from "@/components/ui";
import { PortfolioWorkspace } from "@/components/map/portfolio-workspace";
import { MarketTable } from "@/components/dashboard/market-table";
import { MarketNews } from "@/components/dashboard/market-news";
import { FieldHelp } from "@/components/ui/field-help";
import { getMarketNews } from "@/lib/news";
import { auditBenchmark, buildMarketTable } from "@/lib/market";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let portfolio: Awaited<ReturnType<typeof getPortfolio>> | null = null;
  try {
    portfolio = await getPortfolio();
  } catch (error) {
    console.error("[dashboard]", error);
  }

  if (!portfolio) {
    return (
      <Card className="p-6">
        <h1 className="text-lg font-semibold">Land Bank Corp | Áreas &amp; Galpões</h1>
        <p className="mt-2 text-sm text-muted">
          Não foi possível conectar à base de dados. Inicialize a base em{" "}
          <code className="rounded bg-paper px-1">POST /api/seed</code> e recarregue a página.
        </p>
      </Card>
    );
  }

  const { areas, cityMap, summary, cities } = portfolio;
  const news = await getMarketNews().catch(() => null);
  const mapAreas = toMapAreas(areas, cityMap);
  const ranked = areas
    .map((area) => ({
      area,
      city: cityMap.get(area.citySlug),
      intel: buildIntel(area, cityMap.get(area.citySlug), {
        photos: area.photoCount,
        documents: area.documentCount,
      }),
    }))
    .sort((a, b) => b.intel.score - a.intel.score);
  const featured = areas.filter((area) => area.featured).slice(0, 3);
  const alerts = ranked.flatMap((item) => item.intel.alerts.map((alert) => ({ alert, code: item.area.code, name: item.area.name })));
  const maxCityLand = summary.cityCounts[0]?.landM2 ?? 1;
  const statusOrder = ["disponivel", "em_negociacao", "reservado", "em_estudo"];

  const benchmarkMap = new Map<string, number>();
  for (const city of cityMap.values()) {
    const samples = areas.filter((area) => area.citySlug === city.slug).map((area) => area.pricePerM2);
    benchmarkMap.set(city.name, auditBenchmark(city, undefined, samples).adjusted);
  }
  const marketInput = areas.map((area) => ({
    city: area.city,
    neighborhood: area.neighborhood,
    kind: area.kind,
    transaction: area.transaction,
    landAreaM2: area.landAreaM2,
    builtAreaM2: area.builtAreaM2,
    pricePerM2: area.pricePerM2,
    totalPrice: area.totalPrice,
  }));
  const marketTables = {
    saleByNeighborhood: buildMarketTable(marketInput, benchmarkMap, "neighborhood", "venda"),
    saleByProduct: buildMarketTable(marketInput, benchmarkMap, "product", "venda"),
    rentByNeighborhood: buildMarketTable(marketInput, benchmarkMap, "neighborhood", "locacao"),
    rentByProduct: buildMarketTable(marketInput, benchmarkMap, "product", "locacao"),
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 rounded-2xl bg-forest px-5 py-6 text-white sm:px-7 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-lime px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                Portfolio executivo
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/70 ring-1 ring-inset ring-white/15">
                Base IBGE · Censo 2022
              </span>
              <span className="text-[10px] text-white/40">atualizado em {dateLabel(new Date())}</span>
              <a
                href="https://wa.me/5519994960304"
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/80 ring-1 ring-inset ring-white/15 hover:bg-white/20"
              >
                Contato · +55 19 99496-0304
              </a>
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-[32px]">
              Controle de áreas e galpões
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
              Land bank inteligente para Sumaré-SP, Região Metropolitana de Campinas e Piracicaba. Perímetros KMZ,
              dossiês documentais, indicadores do IBGE e apresentação pronta para clientes e players do mercado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/documentacao"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-white/15"
            >
              <BookOpen className="h-3.5 w-3.5 text-[#e9b7c1]" />
              Documentação
            </Link>
            <Link
              href="/mapa"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-white/15"
            >
              <MapPinned className="h-3.5 w-3.5 text-[#e9b7c1]" />
              Apresentar mapa
            </Link>
            <Link
              href="/areas/nova"
              className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-lime/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Nova área / importar KMZ
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Áreas ativas", value: num(summary.activeAreas), hint: `${num(summary.totalAreas)} no portfólio` },
            { label: "Área total", value: `${num(summary.totalLandM2 / 10_000, 1)} ha`, hint: `${num(summary.totalLandM2)} m²` },
            { label: "Construído", value: `${num(summary.totalBuiltM2)} m²`, hint: `${percent(summary.occupancy)} de ocupação` },
            { label: "VGV do portfólio", value: brl(summary.vgv, { compact: true }), hint: `média ${brl(summary.avgPriceM2)}/m²` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">{item.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{item.value}</p>
              <p className="text-[10px] text-white/45">{item.hint}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Áreas cadastradas" value={num(summary.totalAreas)} sub={`${summary.citiesCount} municípios atendidos`} icon={<Layers className="h-4 w-4" />} />
        <Stat
          label="Terreno no land bank"
          value={`${num(summary.totalLandM2)} m²`}
          sub={`${num(summary.totalLandM2 / 10_000, 2)} ha · ${num(summary.totalLandM2 / ALQUEIRE_PAULISTA_M2, 2)} alq mapeados`}
          icon={<Ruler className="h-4 w-4" />}
        />
        <Stat label="Galpões & construções" value={`${num(summary.totalBuiltM2)} m²`} sub={`${summary.kindCounts.galpao ?? 0} ativos logísticos`} icon={<Building2 className="h-4 w-4" />} />
        <Stat label="Valor por m² (médio)" value={brl(summary.avgPriceM2)} sub="terrenos e galpões" icon={<Wallet className="h-4 w-4" />} />
        <Stat
          label="Land Score médio"
          value={`${summary.avgScore}/100`}
          sub={`${alerts.length} alertas de dossiê`}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="lime"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <PortfolioWorkspace
          areas={mapAreas}
          height={500}
          cities={cities
            .filter((city) => (summary.statusCounts ? summary.cityCounts.some((item) => item.city === city.name) : false))
            .map((city) => ({ slug: city.slug, name: city.name }))}
          title="Mapa do portfólio"
          subtitle="Pontos e perímetros das áreas cadastradas · mapa, satélite e modo humanitário"
        />

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow>Inteligência</Eyebrow>
                <h2 className="mt-1 flex items-center gap-1 text-base font-semibold">
                  Radar de oportunidades <FieldHelp helpKey="inteligencia.score" label="Land Score" />
                </h2>
              </div>
              <Sparkles className="h-4 w-4 text-leaf" />
            </div>
            <div className="mt-3 space-y-3">
              {ranked.slice(0, 4).map(({ area, intel, city }) => (
                <Link key={area.id} href={`/areas/${area.id}`} className="group block rounded-xl border border-line p-2.5 transition hover:border-leaf/50 hover:bg-leaf-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold text-ink group-hover:text-leaf-600">{area.name}</p>
                    <span className="shrink-0 text-[10px] font-semibold tabular-nums text-ink">{intel.score}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {area.city} · {city ? `benchmark ${brl(city.marketPriceM2)}/m²` : "sem base IBGE"}
                  </p>
                  <div className="mt-1.5">
                    <Bar value={intel.score} max={100} tone={intel.score >= 70 ? "leaf" : "amber"} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted">
                    <span>{intel.grade}</span>
                    <span className={intel.marketDeltaPct <= 0 ? "text-leaf-600" : "text-amber-700"}>
                      {intel.marketDeltaPct >= 0 ? "+" : ""}
                      {num(intel.marketDeltaPct)}% vs. benchmark
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/inteligencia" className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-line py-2 text-[11px] font-medium text-ink transition hover:border-leaf hover:text-leaf-600">
              Abrir análise completa <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow>Governança de dados</Eyebrow>
                <h2 className="mt-1 text-base font-semibold">Alertas do portfólio</h2>
              </div>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            {alerts.length === 0 ? (
              <p className="mt-3 rounded-lg bg-leaf-50 p-3 text-[11px] text-leaf-600">
                Todos os dossiês estão completos. Nenhum alerta aberto.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {alerts.slice(0, 4).map((item, index) => (
                  <li key={`${item.code}-${index}`} className="rounded-lg bg-amber-50/70 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-800">{item.code}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{item.alert}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[10px] text-muted">
              {alerts.length} alertas em {summary.totalAreas} ativos. A inteligência prioriza completude do dossiê antes
              de apresentar ao cliente.
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Eyebrow>Fora do controle</Eyebrow>
                <h2 className="mt-1 text-base font-semibold">Consultas</h2>
              </div>
              <Archive className="h-4 w-4 text-muted" />
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Vendidos e cancelados saem do portfólio ativo, do mapa e dos relatórios. Ficam no arquivo para consulta.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-paper/70 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-[0.08em] text-muted">Vendidos</p>
                <p className="text-sm font-semibold tabular-nums">{portfolio.archived.filter((area) => area.status === "vendido").length}</p>
              </div>
              <div className="rounded-lg bg-[#f6e8eb]/70 px-2 py-1.5">
                <p className="text-[9px] uppercase tracking-[0.08em] text-muted">Cancelados</p>
                <p className="text-sm font-semibold tabular-nums">{portfolio.archived.filter((area) => area.status === "cancelado").length}</p>
              </div>
            </div>
            <Link href="/consultas" className="mt-2.5 flex items-center justify-center gap-1 rounded-lg border border-line py-2 text-[11px] font-medium text-ink transition hover:border-leaf hover:text-leaf-600">
              Abrir consultas <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Card>
        </div>
      </div>

      {featured.length ? (
        <section className="space-y-3">
          <SectionTitle
            eyebrow="Showcase"
            title="Destaques para apresentação"
            description="Ativos selecionados pelo time para reuniões com clientes e players do mercado."
            action={
              <Link href="/areas" className="text-xs font-medium text-leaf-600 hover:underline">
                Ver todos os ativos →
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((area) => {
              const intel = buildIntel(area, cityMap.get(area.citySlug), {
                photos: area.photoCount,
                documents: area.documentCount,
              });
              return (
                <Link
                  key={area.id}
                  href={`/areas/${area.id}`}
                  className="group overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative h-40 overflow-hidden bg-paper-deep">
                    {area.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={area.coverUrl} alt={area.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-forest/80 via-forest/10 to-transparent" />
                    <div className="absolute left-3 top-3 flex gap-1.5">
                      <StatusBadge status={area.status} />
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#e9b7c1]">{area.code}</p>
                      <p className="text-sm font-semibold leading-snug text-white">{area.name}</p>
                      <p className="text-[10px] text-white/70">
                        {area.city} · {areaLabel(area.landAreaM2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-3">
                    <div>
                      <p className="text-[10px] text-muted">Valor total</p>
                      <p className="text-sm font-semibold tabular-nums">{brl(area.totalPrice)}</p>
                    </div>
                    <ScorePill score={intel.score} grade={intel.grade} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="p-4 sm:p-5">
          <SectionTitle eyebrow="Cobertura" title="Concentração regional" description="Área mapeada e VGV por município." />
          <div className="mt-4 space-y-3">
            {summary.cityCounts.slice(0, 6).map((item) => (
              <div key={item.city}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium text-ink">{item.city}</p>
                  <p className="text-[10px] text-muted">
                    {item.count} ativo(s) · {areaLabel(item.landM2)} · {brl(item.vgv, { compact: true })}
                  </p>
                </div>
                <div className="mt-1">
                  <Bar value={item.landM2} max={maxCityLand} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <SectionTitle eyebrow="Pipeline" title="Distribuição do portfólio" />
          <div className="mt-4 space-y-2">
            {statusOrder.map((status) => {
              const count = summary.statusCounts[status] ?? 0;
              return (
                <div key={status} className="flex items-center justify-between gap-2">
                  <StatusBadge status={status} />
                  <span className="text-xs font-semibold tabular-nums text-ink">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Tipos de ativo</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(summary.kindCounts).map(([kind, count]) => (
                <span key={kind} className="inline-flex items-center gap-1">
                  <KindBadge kind={kind} />
                  <span className="text-[10px] font-semibold text-ink">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <MarketTable {...marketTables} />

      {news ? (
        <MarketNews
          initial={{
            day: news.day,
            items: news.items,
            indices: news.indices,
            source: news.source,
            fetchedAt: news.fetchedAt,
            stale: news.stale,
            live: news.live,
          }}
        />
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <SectionTitle eyebrow="Base completa" title="Portfólio de áreas e galpões" />
          <Link href="/areas" className="rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium hover:border-leaf hover:text-leaf-600">
            Gerenciar ativos
          </Link>
        </div>
        {areas.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Nenhuma área cadastrada"
              description="Comece importando um arquivo KMZ ou faça o cadastro manual para visualizar os pontos no mapa."
              action={
                <Link href="/areas/nova" className="rounded-lg bg-forest px-3 py-2 text-xs font-medium text-white">
                  Cadastrar primeira área
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Ativo</th>
                  <th className="px-3 py-2 font-semibold">Município</th>
                  <th className="px-3 py-2 font-semibold">Terreno</th>
                  <th className="px-3 py-2 font-semibold">Construção</th>
                  <th className="px-3 py-2 font-semibold">R$/m²</th>
                  <th className="px-3 py-2 font-semibold">Valor total</th>
                  <th className="px-3 py-2 font-semibold">Score</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {ranked.map(({ area, intel }) => (
                  <tr key={area.id} className="text-xs transition hover:bg-paper/40">
                    <td className="px-4 py-2.5">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">{area.code}</p>
                      <p className="max-w-[220px] truncate font-medium text-ink">{area.name}</p>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{area.city}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {areaLabel(area.landAreaM2)}
                      <span className="block text-[9px] text-muted">{num(area.landAreaM2 / ALQUEIRE_PAULISTA_M2, 2)} alq</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{area.builtAreaM2 > 0 ? `${num(area.builtAreaM2)} m²` : "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">{brl(area.pricePerM2)}</td>
                    <td className="px-3 py-2.5 font-medium tabular-nums">{brl(area.totalPrice)}</td>
                    <td className="px-3 py-2.5">
                      <ScorePill score={intel.score} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={area.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/areas/${area.id}`} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-leaf-600 hover:underline">
                        Abrir <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
