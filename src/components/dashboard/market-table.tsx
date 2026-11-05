"use client";

import { useState } from "react";
import { Building2, MapPinned, Table2 } from "lucide-react";
import type { MarketRow } from "@/lib/market";
import { TRANSACTION_LABELS } from "@/lib/format";
import { brl, num } from "@/lib/format";
import { cn } from "@/components/ui";
import { FieldHelp } from "@/components/ui/field-help";

export function MarketTable({
  saleByNeighborhood,
  saleByProduct,
  rentByNeighborhood,
  rentByProduct,
}: {
  saleByNeighborhood: MarketRow[];
  saleByProduct: MarketRow[];
  rentByNeighborhood: MarketRow[];
  rentByProduct: MarketRow[];
}) {
  const [tab, setTab] = useState<"neighborhood" | "product">("neighborhood");
  const [transaction, setTransaction] = useState<"venda" | "locacao">("venda");
  const rows =
    transaction === "venda"
      ? tab === "neighborhood"
        ? saleByNeighborhood
        : saleByProduct
      : tab === "neighborhood"
        ? rentByNeighborhood
        : rentByProduct;
  const totalLand = rows.reduce((sum, row) => sum + row.landM2, 0);
  const totalVgv = rows.reduce((sum, row) => sum + row.vgv, 0);
  const weightedM2 = totalLand > 0 ? rows.reduce((sum, row) => sum + row.avgPriceM2 * row.landM2, 0) / totalLand : 0;

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Inteligência de mercado</p>
          <h2 className="mt-0.5 flex items-center gap-1.5 text-base font-semibold text-ink">
            <Table2 className="h-4 w-4 text-leaf" /> Quadro de M² da região
            <FieldHelp helpKey="inteligencia.marketTable" label="Quadro de M²" />
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            Preços de terreno e galpão praticados no portfólio, comparados ao benchmark auditado de cada município.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-[#8c2f43]/30 bg-[#f6e8eb]/50 p-0.5">
          {(["venda", "locacao"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTransaction(option)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[11px] font-semibold transition",
                transaction === option ? "bg-[#8c2f43] text-white shadow-sm" : "text-[#8c2f43] hover:bg-white/60",
              )}
            >
              {TRANSACTION_LABELS[option]}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-lg border border-line bg-paper p-0.5">
          <button
            type="button"
            onClick={() => setTab("neighborhood")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
              tab === "neighborhood" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <MapPinned className="h-3 w-3" /> Por bairros
          </button>
          <button
            type="button"
            onClick={() => setTab("product")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
              tab === "product" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            <Building2 className="h-3 w-3" /> Por produtos
          </button>
        </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[11px]">
          <thead className="bg-paper/60 text-[9px] uppercase tracking-[0.1em] text-muted">
            <tr>
              <th className="px-4 py-2 font-semibold">{tab === "neighborhood" ? "Bairro / município" : "Produto"}</th>
              <th className="px-3 py-2 font-semibold">Ativos</th>
              <th className="px-3 py-2 font-semibold">M² total</th>
              <th className="px-3 py-2 font-semibold">M² construído</th>
              <th className="px-3 py-2 font-semibold">
                {transaction === "locacao" ? "R$/m²/mês médio" : "R$/m² médio"}
              </th>
              <th className="px-3 py-2 font-semibold">Mín / Máx</th>
              <th className="px-3 py-2 font-semibold">Benchmark</th>
              <th className="px-3 py-2 font-semibold">Δ vs. mercado</th>
              <th className="px-3 py-2 font-semibold">VGV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((row) => (
              <tr key={`${row.label}-${row.product}`} className="transition hover:bg-paper/40">
                <td className="px-4 py-2">
                  <p className="font-medium text-ink">{row.label}</p>
                  <p className="text-[9px] text-muted">
                    <span
                      className={cn(
                        "rounded px-1 py-0.5 font-semibold",
                        row.product === "Galpão / logística"
                          ? "bg-leaf-50 text-leaf-600"
                          : "bg-[#f6e8eb] text-[#8c2f43]",
                      )}
                    >
                      {row.product}
                    </span>{" "}
                    · {TRANSACTION_LABELS[row.transaction] ?? row.transaction}
                  </p>
                </td>
                <td className="px-3 py-2 tabular-nums">{num(row.count)}</td>
                <td className="px-3 py-2 tabular-nums">
                  {num(row.landM2)} <span className="text-[9px] text-muted">({num(row.landM2 / 10000, 2)} ha)</span>
                </td>
                <td className="px-3 py-2 tabular-nums">{row.builtM2 > 0 ? num(row.builtM2) : "—"}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">{brl(row.avgPriceM2)}</td>
                <td className="px-3 py-2 tabular-nums text-muted">
                  {brl(row.minPriceM2)} / {brl(row.maxPriceM2)}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted">{row.benchmark > 0 ? brl(row.benchmark) : "—"}</td>
                <td
                  className={cn(
                    "px-3 py-2 font-semibold tabular-nums",
                    row.deltaPct === 0 ? "text-muted" : row.deltaPct < 0 ? "text-leaf-600" : "text-[#8c2f43]",
                  )}
                >
                  {row.benchmark > 0 ? `${row.deltaPct >= 0 ? "+" : ""}${num(row.deltaPct)}%` : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums">{brl(row.vgv, { compact: true })}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted">
                  Sem ativos precificados para montar o quadro.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot className="border-t border-line bg-paper/40 text-[10px]">
            <tr>
              <td className="px-4 py-2 font-semibold text-ink">Total / média ponderada</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{num(rows.reduce((sum, row) => sum + row.count, 0))}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{num(totalLand)} m²</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{num(rows.reduce((sum, row) => sum + row.builtM2, 0))} m²</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{brl(Math.round(weightedM2))}</td>
              <td colSpan={3} className="px-3 py-2 text-muted">
                Benchmark auditado por município · Δ = preço do portfólio vs. benchmark
              </td>
              <td className="px-3 py-2 font-semibold tabular-nums">{brl(totalVgv, { compact: true })}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t border-line px-4 py-2 text-[9px] leading-relaxed text-muted">
        Venda e locação são analisadas sempre separadamente, e cada grupo compara apenas o mesmo produto (área/gleba ×
        galpão). Imóveis residenciais e de uso misto ficam fora do quadro. M² considera a área de terreno dos ativos ativos
        (vendidos e cancelados não entram); R$/m² é a média simples do grupo e o benchmark é o valor auditado de solo do
        município.
      </p>
    </div>
  );
}
