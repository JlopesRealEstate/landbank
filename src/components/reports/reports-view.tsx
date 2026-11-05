"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Download, FileText, Filter, Printer, RotateCcw } from "lucide-react";
import type { AreaRecord, PortfolioSummary } from "@/lib/intelligence";
import { KIND_LABELS, STATUS_LABELS, areaLabel, brl, num } from "@/lib/format";
import { BrandMark, Card, KindBadge, ScorePill, StatusBadge, cn } from "@/components/ui";
import { BarChartH, ColumnChart, DonutChart, ScatterChart, type ChartDatum } from "@/components/reports/report-charts";
import { distancesToReferences } from "@/lib/references";

export type ReportArea = Pick<
  AreaRecord,
  | "id"
  | "code"
  | "name"
  | "city"
  | "neighborhood"
  | "kind"
  | "status"
  | "landAreaM2"
  | "builtAreaM2"
  | "pricePerM2"
  | "totalPrice"
  | "environmentalRestriction"
  | "zoning"
  | "photoCount"
  | "documentCount"
  | "createdAt"
  | "transaction"
  | "lat"
  | "lng"
  | "partnerName"
  | "partnerPhone"
  | "ownerName"
  | "address"
  | "environmentalNotes"
  | "zoningNotes"
> & {
  restrictionsCount?: number;
  restrictedAreaM2?: number;
  restrictedLossPct?: number;
  score?: number;
  terrainSummary?: { minElevation: number; maxElevation: number; cutVolumeM3: number; fillVolumeM3: number; totalCost: number } | null;
};

type ReportKind = "portfolio" | "kpis" | "cidades" | "ambiental";

const REPORTS: { id: ReportKind; label: string; description: string }[] = [
  { id: "portfolio", label: "Portfólio completo", description: "KPIs, gráficos e relação de imóveis" },
  { id: "kpis", label: "Indicadores & pricing", description: "Comparativo de R$/m², VGV e aproveitamento" },
  { id: "cidades", label: "Concentração regional", description: "Área, VGV e benchmark por município" },
  { id: "ambiental", label: "Restrições ambientais", description: "Ativos com pendência e dossiês incompletos" },
];

export function ReportsView({
  areas,
  summary,
  scores,
  generatedAt,
}: {
  areas: ReportArea[];
  summary: PortfolioSummary;
  scores: Record<number, number>;
  generatedAt: string;
}) {
  const [city, setCity] = useState("todas");
  const [kind, setKind] = useState("todos");
  const [report, setReport] = useState<ReportKind>("portfolio");
  const [sort, setSort] = useState("valor");

  const cityOptions = useMemo(
    () => [...new Set(areas.map((area) => area.city))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [areas],
  );

  const filtered = useMemo(() => {
    const list = areas.filter((area) => {
      if (city !== "todas" && area.city !== city) return false;
      if (kind !== "todos" && area.kind !== kind) return false;
      if (report === "ambiental" && !area.environmentalRestriction) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "valor") return b.totalPrice - a.totalPrice;
      if (sort === "area") return b.landAreaM2 - a.landAreaM2;
      if (sort === "m2") return b.pricePerM2 - a.pricePerM2;
      return b.totalPrice / Math.max(1, b.landAreaM2) - a.totalPrice / Math.max(1, a.landAreaM2);
    });
  }, [areas, city, kind, report, sort]);

  const totals = useMemo(() => {
    const land = filtered.reduce((sum, area) => sum + area.landAreaM2, 0);
    const built = filtered.reduce((sum, area) => sum + area.builtAreaM2, 0);
    const vgv = filtered.reduce((sum, area) => sum + area.totalPrice, 0);
    const priced = filtered.filter((area) => area.pricePerM2 > 0);
    const avgM2 = priced.length ? priced.reduce((sum, area) => sum + area.pricePerM2, 0) / priced.length : 0;
    const env = filtered.filter((area) => area.environmentalRestriction).length;
    const scoreAvg = filtered.length
      ? filtered.reduce((sum, area) => sum + (scores[area.id] ?? 0), 0) / filtered.length
      : 0;
    const restrictedM2 = filtered.reduce((sum, area) => sum + (area.restrictedAreaM2 ?? 0), 0);
    const restrictedPct = filtered.reduce((sum, area) => sum + (area.restrictedLossPct ?? 0), 0);
    const gradingCost = filtered.reduce((sum, area) => sum + (area.terrainSummary?.totalCost ?? 0), 0);
    const gradingCut = filtered.reduce((sum, area) => sum + (area.terrainSummary?.cutVolumeM3 ?? 0), 0);
    const gradingFill = filtered.reduce((sum, area) => sum + (area.terrainSummary?.fillVolumeM3 ?? 0), 0);
    const netLand = Math.max(0, land - restrictedM2);
    return {
      land,
      built,
      vgv,
      avgM2,
      env,
      scoreAvg,
      count: filtered.length,
      occupancy: land ? (built / land) * 100 : 0,
      restrictedM2,
      restrictedPct,
      gradingCost,
      gradingCut,
      gradingFill,
      netLand,
      avgPricePerHa: land > 0 ? (vgv / land) * 10_000 : 0,
      hubAverages: (() => {
        if (!filtered.length) return null;
        const samples = filtered.map((item) => distancesToReferences({ lat: item.lat, lng: item.lng }));
        const average = (id: string) => {
          const values = samples.map((list) => list.find((item) => item.id === id)?.km ?? 0).filter((km) => km > 0);
          return values.length ? Math.round((values.reduce((sum, km) => sum + km, 0) / values.length) * 10) / 10 : 0;
        };
        return {
          viracopos: average("viracopos"),
          cumbica: average("cumbica"),
          congonhas: average("congonhas"),
          port: average("porto-santos"),
        };
      })(),
    };
  }, [filtered, scores]);

  const cityChart: ChartDatum[] = useMemo(() => {
    const map = new Map<string, { land: number; vgv: number; count: number }>();
    for (const area of filtered) {
      const current = map.get(area.city) ?? { land: 0, vgv: 0, count: 0 };
      current.land += area.landAreaM2;
      current.vgv += area.totalPrice;
      current.count += 1;
      map.set(area.city, current);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value: value.land, extra: `${value.count} ativo(s)` }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const priceChart: ChartDatum[] = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.pricePerM2 - a.pricePerM2)
        .map((area) => ({ label: area.code, value: area.pricePerM2, extra: area.city })),
    [filtered],
  );

  const vgvChart: ChartDatum[] = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => b.totalPrice - a.totalPrice)
        .slice(0, 8)
        .map((area) => ({ label: area.code, value: area.totalPrice, extra: area.city })),
    [filtered],
  );

  const kindChart: ChartDatum[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const area of filtered) map.set(area.kind, (map.get(area.kind) ?? 0) + 1);
    return [...map.entries()].map(([label, value]) => ({ label: KIND_LABELS[label] ?? label, value }));
  }, [filtered]);

  const statusChart: ChartDatum[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const area of filtered) map.set(area.status, (map.get(area.status) ?? 0) + 1);
    return [...map.entries()].map(([label, value]) => ({ label: STATUS_LABELS[label] ?? label, value }));
  }, [filtered]);

  const highwayIds = [
    "bandeirantes",
    "anhanguera",
    "dom-pedro",
    "santos-dumont",
    "sp101",
    "regis-bittencourt",
    "dutra",
    "fernao-dias",
    "castelo-branco",
  ];

  const highwayChart: ChartDatum[] = useMemo(() => {
    if (!filtered.length) return [];
    const samples = filtered.map((area) => distancesToReferences({ lat: area.lat, lng: area.lng }));
    return highwayIds
      .map((id) => {
        const values = samples.map((list) => list.find((item) => item.id === id)?.km ?? 0).filter((km) => km > 0);
        const average = values.length ? values.reduce((sum, km) => sum + km, 0) / values.length : 0;
        const label = samples[0]?.find((item) => item.id === id)?.short ?? id;
        return { label, value: Math.round(average * 10) / 10 };
      })
      .sort((first, second) => first.value - second.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const hubChart: ChartDatum[] = useMemo(() => {
    if (!filtered.length) return [];
    const samples = filtered.map((area) => distancesToReferences({ lat: area.lat, lng: area.lng }));
    return ["viracopos", "congonhas", "cumbica", "porto-santos", "sao-paulo"]
      .map((id) => {
        const values = samples.map((list) => list.find((item) => item.id === id)?.km ?? 0).filter((km) => km > 0);
        const average = values.length ? values.reduce((sum, km) => sum + km, 0) / values.length : 0;
        const label = samples[0]?.find((item) => item.id === id)?.short ?? id;
        return { label, value: Math.round(average * 10) / 10 };
      })
      .sort((first, second) => first.value - second.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  const scatter = filtered.map((area) => ({
    x: area.landAreaM2,
    y: area.pricePerM2,
    label: `${area.code} · ${area.name}`,
    kind: area.kind,
  }));

  const topRoi = [...filtered].sort(
    (a, b) => b.totalPrice / Math.max(1, b.landAreaM2) - a.totalPrice / Math.max(1, a.landAreaM2),
  )[0];

  function exportCsv() {
    const header = [
      "codigo",
      "nome",
      "municipio",
      "bairro",
      "tipo",
      "status",
      "terreno_m2",
      "construcao_m2",
      "valor_m2",
      "valor_total",
      "zoneamento",
      "restricao_ambiental",
      "fotos",
      "documentos",
      "score",
    ];
    const rows = filtered.map((area) =>
      [
        area.code,
        area.name,
        area.city,
        area.neighborhood,
        KIND_LABELS[area.kind] ?? area.kind,
        STATUS_LABELS[area.status] ?? area.status,
        area.landAreaM2,
        area.builtAreaM2,
        area.pricePerM2,
        area.totalPrice,
        area.zoning,
        area.environmentalRestriction ? "sim" : "nao",
        area.photoCount,
        area.documentCount,
        scores[area.id] ?? 0,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob([[header.join(";"), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `landbank-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card className="no-print p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            <Filter className="h-3.5 w-3.5" /> Filtros
          </div>
          <select value={report} onChange={(event) => setReport(event.target.value as ReportKind)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
            {REPORTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select value={city} onChange={(event) => setCity(event.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
            <option value="todas">Todos os municípios</option>
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={kind} onChange={(event) => setKind(event.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
            <option value="todos">Todos os tipos</option>
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs">
            <option value="valor">Maior valor total</option>
            <option value="area">Maior área</option>
            <option value="m2">Maior R$/m²</option>
            <option value="eficiencia">Maior valor por hectare</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setCity("todas");
              setKind("todos");
              setSort("valor");
              setReport("portfolio");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs text-muted hover:text-ink"
          >
            <RotateCcw className="h-3 w-3" /> Limpar
          </button>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-xs font-medium text-ink hover:border-leaf">
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#8c2f43] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#7a2739]">
              <Printer className="h-3.5 w-3.5" /> Exportar PDF
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          O PDF é gerado com o mesmo layout da tela. Na janela de impressão escolha &quot;Salvar como PDF&quot; e ative
          &quot;Gráficos em segundo plano&quot;. Imóveis vendidos e cancelados não entram nos relatórios.
        </p>
      </Card>

      <div id="report-sheet" className="report-sheet space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-start gap-3">
            <BrandMark className="h-11 w-11" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">
                Land Bank Corp<span className="ml-1 font-normal text-muted">| Áreas &amp; Galpões</span>
              </p>
              <h1 className="mt-0.5 text-lg font-semibold text-ink">
                {REPORTS.find((item) => item.id === report)?.label}
              </h1>
              <p className="text-[10px] text-muted">
                {REPORTS.find((item) => item.id === report)?.description} · Emitido em {generatedAt} · Portfólio ativo
                {city !== "todas" ? ` · ${city}` : ""}
                {kind !== "todos" ? ` · ${KIND_LABELS[kind]}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">Ativos no relatório</p>
            <p className="text-2xl font-semibold tabular-nums text-ink">{num(totals.count)}</p>
            <p className="text-[10px] text-muted">{areaLabel(totals.land)} · {brl(totals.vgv, { compact: true })}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Terreno total", value: areaLabel(totals.land), hint: `${num(totals.land)} m²` },
            { label: "Construído", value: `${num(totals.built)} m²`, hint: `${num(totals.occupancy)}% ocupação` },
            { label: "VGV", value: brl(totals.vgv, { compact: true }), hint: "soma dos valores pedidos" },
            { label: "R$/m² médio", value: brl(totals.avgM2), hint: "ativos com preço" },
            { label: "Restrição ambiental", value: `${num(totals.env)} ativo(s)`, hint: "exigem due diligence" },
            { label: "Land Score médio", value: `${num(totals.scoreAvg)}/100`, hint: "motor de inteligência" },
            { label: "Perda por restrições", value: `${num(totals.restrictedM2)} m²`, hint: `${num(totals.restrictedPct)}% da área` },
            { label: "Custo de terraplenagem", value: brl(totals.gradingCost, { compact: true }), hint: "estimativa do portfólio" },
            { label: "Com dossiê completo", value: num(filtered.filter((area) => (area.documentCount ?? 0) > 0 && (area.photoCount ?? 0) > 0).length), hint: "fotos + documentos" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-line bg-paper/40 p-2.5">
              <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">{item.label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink">{item.value}</p>
              <p className="text-[8px] text-muted">{item.hint}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Área por município (ha)</p>
            <div className="mt-3">
              <BarChartH data={cityChart} format="area" maxItems={8} />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Distribuição por tipo</p>
            <div className="mt-3">
              <DonutChart data={kindChart} unit="ativos" />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">R$/m² por ativo</p>
            <div className="mt-3">
              <ColumnChart data={priceChart} format="currency" />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Preço x área (m²)</p>
            <div className="mt-3">
              <ScatterChart points={scatter} />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Top VGV (R$)</p>
            <div className="mt-3">
              <BarChartH data={vgvChart} format="currency" maxItems={8} />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Pipeline por status</p>
            <div className="mt-3">
              <DonutChart data={statusChart} unit="ativos" />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Distâncias médias — rodovias
            </p>
            <div className="mt-3">
              <BarChartH data={highwayChart} format="number" maxItems={10} />
            </div>
            <p className="mt-1 text-[8px] text-muted">média em km dos ativos filtrados até o eixo de cada rodovia</p>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Distâncias médias — aeroportos, porto e capital
            </p>
            <div className="mt-3">
              <BarChartH data={hubChart} format="number" maxItems={6} />
            </div>
            <p className="mt-1 text-[8px] text-muted">
              Viracopos {num(totals.hubAverages?.viracopos ?? 0, 1)} km · Cumbica{" "}
              {num(totals.hubAverages?.cumbica ?? 0, 1)} km · Congonhas {num(totals.hubAverages?.congonhas ?? 0, 1)} km ·
              Porto {num(totals.hubAverages?.port ?? 0, 1)} km
            </p>
          </div>
        </section>

        {topRoi ? (
          <section className="rounded-xl border border-[#e3c2c9] bg-[#f6e8eb]/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8c2f43]">Destaque do relatório</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {topRoi.code} · {topRoi.name}
                </p>
                <p className="text-[10px] text-muted">
                  {topRoi.city} · {areaLabel(topRoi.landAreaM2)} · {brl(topRoi.pricePerM2)}/m² ·{" "}
                  {brl(topRoi.totalPrice / Math.max(1, topRoi.landAreaM2 / 10_000))}/hectare
                </p>
              </div>
              <ScorePill score={scores[topRoi.id] ?? 0} />
            </div>
          </section>
        ) : null}

        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Fichas-resumo do portfólio ({filtered.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.slice(0, 8).map((area) => (
              <div key={`detail-${area.id}`} className="rounded-lg border border-line px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">{area.code}</p>
                    <p className="truncate text-[11px] font-semibold text-ink">{area.name}</p>
                    <p className="truncate text-[9px] text-muted">{area.address || `${area.neighborhood} · ${area.city}`}</p>
                  </div>
                  <ScorePill score={scores[area.id] ?? 0} />
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-muted">
                  <p>
                    Terreno <strong className="text-ink-soft">{areaLabel(area.landAreaM2)}</strong>
                  </p>
                  <p>
                    Construção <strong className="text-ink-soft">{area.builtAreaM2 ? `${num(area.builtAreaM2)} m²` : "—"}</strong>
                  </p>
                  <p>
                    {area.transaction === "locacao" ? "Locação" : "Venda"} <strong className="text-ink-soft">{brl(area.pricePerM2)}/m²</strong>
                  </p>
                  <p>
                    Total <strong className="text-ink-soft">{brl(area.totalPrice)}</strong>
                  </p>
                  <p>
                    Zoneamento <strong className="text-ink-soft">{area.zoning || "n/d"}</strong>
                  </p>
                  <p>
                    Ambiental{" "}
                    <strong className={area.environmentalRestriction ? "text-[#8c2f43]" : "text-leaf-600"}>
                      {area.environmentalRestriction ? "restrição" : "livre"}
                    </strong>
                  </p>
                  {(area.restrictionsCount ?? 0) > 0 ? (
                    <p className="col-span-2">
                      Restrições demarcadas{" "}
                      <strong className="text-[#8c2f43]">
                        {area.restrictionsCount} · {areaLabel(area.restrictedAreaM2 ?? 0)} ({num(area.restrictedLossPct ?? 0, 2)}% de perda)
                      </strong>
                    </p>
                  ) : null}
                  {area.terrainSummary ? (
                    <p className="col-span-2">
                      Topografia{" "}
                      <strong className="text-ink-soft">
                        {num(area.terrainSummary.minElevation, 1)}–{num(area.terrainSummary.maxElevation, 1)} m · corte{" "}
                        {num(area.terrainSummary.cutVolumeM3)} m³ · aterro {num(area.terrainSummary.fillVolumeM3)} m³ ·{" "}
                        {brl(area.terrainSummary.totalCost, { compact: true })}
                      </strong>
                    </p>
                  ) : null}
                  <p className="col-span-2">
                    Proprietário <strong className="text-ink-soft">{area.ownerName || "—"}</strong> · corretor{" "}
                    <strong className="text-ink-soft">{area.partnerName || "—"}</strong>
                    {area.partnerPhone ? ` · ${area.partnerPhone}` : ""}
                  </p>
                  <p className="col-span-2">
                    Dossiê{" "}
                    <strong className="text-ink-soft">
                      {num(area.photoCount)} foto(s) · {num(area.documentCount)} documento(s)
                    </strong>{" "}
                    · Fotos {num(area.photoCount)} · Docs {num(area.documentCount)}
                  </p>
                  {area.zoningNotes ? (
                    <p className="col-span-2 truncate">
                      Parâmetros <strong className="text-ink-soft">{area.zoningNotes}</strong>
                    </p>
                  ) : null}
                  {area.environmentalNotes ? (
                    <p className="col-span-2 truncate">
                      Ambiental <strong className="text-[#8c2f43]">{area.environmentalNotes}</strong>
                    </p>
                  ) : null}
                  <p className="col-span-2 text-[8.5px] text-muted">
                    Distâncias:{" "}
                    {distancesToReferences({ lat: area.lat, lng: area.lng })
                      .filter((item) => ["viracopos", "cumbica", "porto-santos", "anhanguera", "bandeirantes", "sao-paulo", "sp101"].includes(item.id))
                      .sort((first, second) => first.km - second.km)
                      .map((item) => `${item.short} ${num(item.km, 1)} km`)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Relação de imóveis ({filtered.length})
            </p>
            <Link href="/areas" className="no-print inline-flex items-center gap-0.5 text-[10px] font-medium text-leaf-600 hover:underline">
              abrir portfólio <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[11px]">
              <thead className="border-y border-line bg-paper/50 text-[8px] uppercase tracking-[0.1em] text-muted">
                <tr>
                  <th className="px-2 py-2 font-semibold">Código</th>
                  <th className="px-2 py-2 font-semibold">Imóvel</th>
                  <th className="px-2 py-2 font-semibold">Município</th>
                  <th className="px-2 py-2 font-semibold">Tipo</th>
                  <th className="px-2 py-2 font-semibold">Terreno</th>
                  <th className="px-2 py-2 font-semibold">Construção</th>
                  <th className="px-2 py-2 font-semibold">R$/m²</th>
                  <th className="px-2 py-2 font-semibold">Valor total</th>
                  <th className="px-2 py-2 font-semibold">Transação</th>
                  <th className="px-2 py-2 font-semibold">Ambiental</th>
                  <th className="px-2 py-2 font-semibold">Restrições</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filtered.map((area) => (
                  <tr key={area.id} className={cn("align-top", area.environmentalRestriction && "bg-[#f6e8eb]/30")}>
                    <td className="px-2 py-1.5 font-semibold uppercase text-muted">{area.code}</td>
                    <td className="max-w-[190px] px-2 py-1.5">
                      <p className="truncate font-medium text-ink">{area.name}</p>
                      <p className="truncate text-[9px] text-muted">{area.zoning || "zoneamento n/d"}</p>
                    </td>
                    <td className="px-2 py-1.5 text-ink-soft">{area.city}</td>
                    <td className="px-2 py-1.5">
                      <KindBadge kind={area.kind} />
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{areaLabel(area.landAreaM2)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{area.builtAreaM2 ? `${num(area.builtAreaM2)} m²` : "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{brl(area.pricePerM2)}</td>
                    <td className="px-2 py-1.5 font-medium tabular-nums">{brl(area.totalPrice)}</td>
                    <td className="px-2 py-1.5">{area.transaction === "locacao" ? "Locação" : "Venda"}</td>
                    <td className="px-2 py-1.5">{area.environmentalRestriction ? "sim" : "não"}</td>
                    <td className="px-2 py-1.5 tabular-nums">
                      {area.restrictionsCount ? `${area.restrictionsCount} · ${num(area.restrictedLossPct ?? 0, 2)}%` : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status={area.status} />
                    </td>
                    <td className="px-2 py-1.5 tabular-nums">{scores[area.id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line text-[10px]">
                <tr>
                  <td colSpan={4} className="px-2 py-2 font-semibold text-ink">
                    Total ({filtered.length} ativos)
                  </td>
                  <td className="px-2 py-2 font-semibold tabular-nums">{areaLabel(totals.land)}</td>
                  <td className="px-2 py-2 font-semibold tabular-nums">{num(totals.built)} m²</td>
                  <td className="px-2 py-2 font-semibold tabular-nums">{brl(totals.avgM2)}</td>
                  <td className="px-2 py-2 font-semibold tabular-nums">{brl(totals.vgv)}</td>
                  <td colSpan={4} className="px-2 py-2 text-muted">
                    Land Bank Corp · portfólio ativo
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-[8px] text-muted">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-2.5 w-2.5" /> Land Bank Corp | Áreas &amp; Galpões · {summary.totalAreas} ativos no
            portfólio · relatório gerado pelo CRM
          </span>
          <span>Indicadores: IBGE Censo 2022 / Censo 2010 / IBGE Cidades / PNUD. Valores sujeitos a confirmação.</span>
        </footer>
      </div>
    </div>
  );
}
