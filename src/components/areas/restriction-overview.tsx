"use client";

import { areaLabel, num } from "@/lib/format";
import { restrictionColor, restrictionLabel, type RestrictionItem } from "@/lib/restriction-types";

/**
 * VISÃO GERAL DAS DEMARCAÇÕES DE PERDA — SVG puro (renderiza no servidor).
 * Garante que a demarcação apareça IMEDIATAMENTE ao abrir a ficha, mesmo antes
 * do mapa interativo carregar. Nunca desaparece: é derivada das restrições salvas.
 */

export { restrictionColor, restrictionLabel } from "@/lib/restriction-types";

export function RestrictionOverview({
  geometry,
  restrictions,
  totalAreaM2,
  draft,
  draftAreaM2 = 0,
  onFocus,
  onEdit,
  onDelete,
}: {
  geometry?: [number, number][][];
  restrictions: RestrictionItem[];
  totalAreaM2: number;
  draft?: [number, number][];
  draftAreaM2?: number;
  onFocus?: (item: RestrictionItem) => void;
  onEdit?: (item: RestrictionItem) => void;
  onDelete?: (item: RestrictionItem) => void;
}) {
  const rings = (geometry ?? []).filter((ring) => ring.length > 2);
  const hasDraft = (draft?.length ?? 0) >= 3;

  const allPoints = [
    ...rings.flatMap((ring) => ring),
    ...restrictions.flatMap((item) => item.coordinates),
    ...(draft ?? []),
  ];

  // perda = somente o que está DENTRO da demarcação do KMZ
  const restrictedM2 = restrictions.reduce((sum, item) => sum + item.areaM2, 0);
  const lossPct = restrictions.reduce((sum, item) => sum + item.lossPct, 0);
  const outsideM2 = restrictions.reduce((sum, item) => sum + (item.outsideAreaM2 ?? 0), 0);

  const width = 560;
  const height = 300;
  const pad = 16;

  const lngs = allPoints.map(([lng]) => lng);
  const lats = allPoints.map(([, lat]) => lat);
  const west = lngs.length ? Math.min(...lngs) : -47.28;
  const east = lngs.length ? Math.max(...lngs) : -47.26;
  const south = lats.length ? Math.min(...lats) : -22.83;
  const north = lats.length ? Math.max(...lats) : -22.81;
  const toX = (lng: number) => pad + ((lng - west) / (east - west || 1)) * (width - pad * 2);
  const toY = (lat: number) => pad + ((north - lat) / (north - south || 1)) * (height - pad * 2);
  const toPoints = (ring: [number, number][]) => ring.map(([lng, lat]) => `${toX(lng)},${toY(lat)}`).join(" ");

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-2.5 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
          Demarcações de perda — dentro do KMZ
        </p>
        <p className="text-[10px] font-semibold tabular-nums text-[#8c2f43]">
          perda total {num(lossPct, 2)}% · {areaLabel(restrictedM2)} dentro da demarcação
        </p>
      </div>

      {restrictions.length === 0 && !hasDraft ? (
        <div className="px-3 py-6 text-center">
          <p className="text-[11px] font-medium text-ink">Nenhuma demarcação de perda registrada</p>
          <p className="mt-0.5 text-[10px] text-muted">
            Clique no mapa abaixo para demarcar APP, nascente, linhão e demais faixas não aproveitáveis. A área e o
            percentual de perda são calculados automaticamente e permanecem visíveis.
          </p>
        </div>
      ) : (
        <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_190px]">
          <div className="relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full bg-[#eef1ee]" role="img" aria-label="Demarcações de perda">
              {rings.map((ring, index) => (
                <polygon
                  key={`kmz-${index}`}
                  points={toPoints(ring)}
                  fill="#0b2a35"
                  fillOpacity="0.04"
                  stroke="#1c5a6b"
                  strokeWidth="2"
                />
              ))}
              {restrictions.map((item) => {
                const color = restrictionColor(item.type);
                return (
                  <g key={`restriction-${item.id}`} data-restriction={item.id}>
                    <polygon
                      points={toPoints(item.coordinates)}
                      fill={color}
                      fillOpacity="0.5"
                      stroke={color}
                      strokeWidth="2"
                      strokeDasharray={item.geometryType === "axis" ? undefined : "6 4"}
                    />
                    {item.axisMeta?.axis?.length ? (
                      <polyline
                        points={toPoints(item.axisMeta.axis)}
                        fill="none"
                        stroke="#f0c623"
                        strokeWidth="2"
                      />
                    ) : null}
                    {item.coordinates.length ? (
                      <text
                        x={toX(item.coordinates.reduce((sum, point) => sum + point[0], 0) / item.coordinates.length)}
                        y={toY(item.coordinates.reduce((sum, point) => sum + point[1], 0) / item.coordinates.length)}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="700"
                        fill="#0b2a35"
                        stroke="#ffffff"
                        strokeWidth="2.4"
                        paintOrder="stroke"
                      >
                        {restrictionLabel(item.type).split(" ")[0]} · {num(item.lossPct, 2)}%
                      </text>
                    ) : null}
                  </g>
                );
              })}
              {hasDraft ? (
                <polygon
                  points={toPoints(draft as [number, number][])}
                  fill="#a8465c"
                  fillOpacity="0.22"
                  stroke="#a8465c"
                  strokeWidth="2"
                  strokeDasharray="8 5"
                />
              ) : null}
            </svg>
            <p className="absolute bottom-1 left-2 rounded bg-white/90 px-1.5 py-0.5 text-[8px] text-muted">
              contorno azul = perímetro KMZ · verde-limão = perda demarcada · linha amarela = eixo de linhão
            </p>
          </div>

          <ul className="max-h-[300px] divide-y divide-line/70 overflow-y-auto border-t border-line text-[10px] sm:border-l sm:border-t-0">
            {restrictions.map((item) => (
              <li key={`list-${item.id}`} className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: restrictionColor(item.type) }}
                  />
                  <span className="truncate font-medium text-ink">{restrictionLabel(item.type)}</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums text-[#8c2f43]">
                    {num(item.lossPct, 2)}%
                  </span>
                </div>
                <p className="truncate text-[9px] text-muted">
                  {areaLabel(item.areaM2)} (no KMZ)
                  {item.geometryType === "axis" && item.axisMeta
                    ? ` · eixo ${num(item.axisMeta.lengthM, 0)} m · faixa ${item.axisMeta.widthM} m (${item.axisMeta.setbackM} m/lado)`
                    : item.label
                      ? ` · ${item.label}`
                      : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => onFocus?.(item)}
                    className="rounded border border-line px-1.5 py-0.5 text-[8.5px] font-medium text-ink-soft hover:border-leaf hover:text-leaf-600"
                  >
                    localizar
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit?.(item)}
                    className="rounded border border-[#8c2f43]/40 px-1.5 py-0.5 text-[8.5px] font-semibold text-[#8c2f43] hover:border-[#8c2f43]"
                  >
                    corrigir
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete?.(item)}
                    className="rounded border border-line px-1.5 py-0.5 text-[8.5px] font-medium text-ink-soft hover:border-[#b91c1c] hover:text-[#b91c1c]"
                  >
                    excluir
                  </button>
                </div>
              </li>
            ))}
            {hasDraft ? (
              <li className="px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-[#a8465c]" />
                  <span className="truncate font-medium text-ink">Em demarcação</span>
                  <span className="ml-auto shrink-0 font-semibold tabular-nums text-[#a8465c]">
                    {totalAreaM2 > 0 ? `${num((draftAreaM2 / totalAreaM2) * 100, 2)}%` : "—"}
                  </span>
                </div>
                <p className="text-[9px] text-muted">
                  {areaLabel(draftAreaM2)} · {draft?.length ?? 0} pontos marcados
                </p>
              </li>
            ) : null}
            <li className="px-2 py-1.5">
              <p className="text-[9px] text-muted">
                Área aproveitável dentro do KMZ:{" "}
                <strong className="text-ink-soft">{areaLabel(Math.max(0, totalAreaM2 - restrictedM2))}</strong>
              </p>
              {outsideM2 > 0 ? (
                <p className="text-[8.5px] text-muted">
                  {areaLabel(outsideM2)} demarcados fora do KMZ foram desconsiderados
                </p>
              ) : null}
              <p className="text-[8px] text-muted">perda calculada somente no interior da demarcação (m² do KMZ)</p>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
