import Link from "next/link";
import { Archive, ArrowUpRight, Ban, History } from "lucide-react";
import { getPortfolio } from "@/lib/data";
import { areaLabel, brl, dateLabel, num } from "@/lib/format";
import { Card, Eyebrow, KindBadge, SectionTitle, Stat, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ConsultasPage() {
  const portfolio = await getPortfolio();
  const archived = portfolio.archived;
  const sold = archived.filter((area) => area.status === "vendido");
  const cancelled = archived.filter((area) => area.status === "cancelado");
  const soldValue = sold.reduce((sum, area) => sum + area.totalPrice, 0);
  const cancelledValue = cancelled.reduce((sum, area) => sum + area.totalPrice, 0);
  const avgSoldM2 = sold.length ? sold.reduce((sum, area) => sum + area.pricePerM2, 0) / sold.length : 0;

  const sections = [
    {
      key: "vendido",
      title: "Imóveis vendidos",
      description: "Ativos concluídos, mantidos como referência de pricing e histórico de performance.",
      icon: Archive,
      items: sold,
    },
    {
      key: "cancelado",
      title: "Imóveis cancelados",
      description: "Cadastros encerrados (due diligence reprovada, desistência ou erro de origem).",
      icon: Ban,
      items: cancelled,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Eyebrow>Consulta histórica</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Vendidos &amp; cancelados</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Estes imóveis saíram do controle operacional: não aparecem em Áreas &amp; Galpões, no mapa, nos indicadores nem
          nos KPIs do portfólio. Ficam aqui apenas para consulta, auditoria e comparativo de mercado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total em consulta" value={num(archived.length)} sub="fora do controle ativo" icon={<History className="h-4 w-4" />} />
        <Stat label="Vendidos" value={num(sold.length)} sub={`${brl(soldValue, { compact: true })} transacionados`} icon={<Archive className="h-4 w-4" />} tone="lime" />
        <Stat
          label="Cancelados"
          value={num(cancelled.length)}
          sub={`${brl(cancelledValue, { compact: true })} retirados do pipeline`}
          icon={<Ban className="h-4 w-4" />}
        />
        <Stat label="R$/m² médio vendido" value={sold.length ? brl(avgSoldM2) : "—"} sub="referência de mercado" icon={<ArrowUpRight className="h-4 w-4" />} />
      </div>

      <Card className="border-[#e3c2c9] bg-[#f6e8eb]/40 p-3">
        <p className="text-[11px] leading-relaxed text-[#8c2f43]">
          <strong>Regra de negócio:</strong> imóveis com status <strong>Vendido</strong> ou <strong>Cancelado</strong> são
          automaticamente excluídos do portfólio ativo. Para devolver um ativo ao controle, edite o cadastro e altere o
          status para Disponível, Em estudo, Em negociação ou Reservado.
        </p>
      </Card>

      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <Card key={section.key} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper text-ink-soft">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <SectionTitle title={section.title} description={section.description} />
                </div>
              </div>
              <StatusBadge status={section.key} />
            </div>
            {section.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">Nenhum imóvel nesta condição.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Código</th>
                      <th className="px-3 py-2 font-semibold">Imóvel</th>
                      <th className="px-3 py-2 font-semibold">Município</th>
                      <th className="px-3 py-2 font-semibold">Tipo</th>
                      <th className="px-3 py-2 font-semibold">Terreno</th>
                      <th className="px-3 py-2 font-semibold">R$/m²</th>
                      <th className="px-3 py-2 font-semibold">Valor</th>
                      <th className="px-3 py-2 font-semibold">Encerrado em</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {section.items.map((area) => (
                      <tr key={area.id} className="transition hover:bg-paper/40">
                        <td className="px-4 py-2.5 font-semibold uppercase tracking-[0.06em] text-muted">{area.code}</td>
                        <td className="px-3 py-2.5">
                          <p className="max-w-[240px] truncate font-medium text-ink">{area.name}</p>
                          <p className="text-[10px] text-muted">{area.environmentalRestriction ? "com restrição ambiental" : "sem restrição ambiental"}</p>
                        </td>
                        <td className="px-3 py-2.5 text-ink-soft">
                          {area.city}
                          {area.neighborhood ? ` · ${area.neighborhood}` : ""}
                        </td>
                        <td className="px-3 py-2.5">
                          <KindBadge kind={area.kind} />
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{areaLabel(area.landAreaM2)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{brl(area.pricePerM2)}</td>
                        <td className="px-3 py-2.5 font-medium tabular-nums">{brl(area.totalPrice)}</td>
                        <td className="px-3 py-2.5 text-muted">{dateLabel(area.updatedAt)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Link href={`/areas/${area.id}`} className="inline-flex items-center gap-0.5 text-[11px] font-medium text-leaf-600 hover:underline">
                            Consultar <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
