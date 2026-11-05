"use client";

import type { TerrainProfile } from "@/db/schema";
import { num } from "@/lib/format";

/**
 * Perfil de elevação no padrão Google Earth:
 * ganho/perda de elevação, inclinação máxima e inclinação média,
 * com escala em metros e leitura por amostra SRTM.
 */
export function ElevationProfileChart({
  profile,
  height = 170,
  tone = "comprimento",
}: {
  profile: TerrainProfile;
  height?: number;
  tone?: "comprimento" | "largura";
}) {
  const points = profile.points ?? [];
  const accent = tone === "comprimento" ? "#8c2f43" : "#1c5a6b";

  if (points.length < 2) {
    return (
      <p className="rounded-lg bg-paper/70 px-3 py-2 text-[10px] text-muted">
        Perfil de {tone} indisponível: perímetro sem dados de elevação suficientes.
      </p>
    );
  }

  const width = 640;
  const padding = { left: 40, right: 10, top: 10, bottom: 22 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const elevations = points.map((point) => point.elevation);
  const target = points[0].target;
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const span = max - min || 1;
  const maxDistance = points[points.length - 1].distanceM || 1;

  const x = (distance: number) => padding.left + (distance / maxDistance) * innerWidth;
  const y = (elevation: number) => padding.top + innerHeight - ((elevation - min) / span) * innerHeight;

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.distanceM).toFixed(2)},${y(point.elevation).toFixed(2)}`)
    .join(" ");
  const baseY = padding.top + innerHeight;
  const areaPath = `${linePath} L${x(maxDistance).toFixed(2)},${baseY} L${padding.left},${baseY} Z`;

  const ticks = 3;
  const elevationTicks = Array.from({ length: ticks + 1 }, (_, index) => min + (span * index) / ticks);
  const distanceTicks = Array.from({ length: 5 }, (_, index) => (maxDistance * index) / 4);

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-line px-2.5 py-1.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink">
            Perfil de {tone}
          </p>
          <p className="text-[9px] text-muted">
            {num(profile.lengthM, 1)} m · {profile.direction} · {num(profile.samples)} amostras a cada{" "}
            {num(profile.spacingM, 1)} m
          </p>
        </div>
        <div className="text-right">
          <p className="text-[8px] uppercase tracking-[0.08em] text-muted">Ganho/perda de elevação</p>
          <p className="text-[10px] font-semibold tabular-nums text-ink">
            {num(profile.gainM, 1)} m · {num(profile.lossM, 1)} m
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line bg-paper/50 px-2.5 py-1 text-[8px] text-muted">
        <span>
          Inclinação máxima:{" "}
          <strong className="text-ink-soft">
            {num(profile.maxSlopeUp, 1)}% · -{num(profile.maxSlopeDown, 1)}%
          </strong>
        </span>
        <span>
          Inclinação média:{" "}
          <strong className="text-ink-soft">
            {num(profile.avgSlopeUp, 1)}% · -{num(profile.avgSlopeDown, 1)}%
          </strong>
        </span>
        <span>
          Cotas:{" "}
          <strong className="text-ink-soft">
            {num(min, 1)}–{num(max, 1)} m
          </strong>
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full px-1" role="img" aria-label={`Perfil de ${tone}`}>
        <defs>
          <clipPath id={`cut-${tone}`}>
            <rect x={padding.left} y={padding.top} width={innerWidth} height={Math.max(0, y(target) - padding.top)} />
          </clipPath>
          <clipPath id={`fill-${tone}`}>
            <rect
              x={padding.left}
              y={y(target)}
              width={innerWidth}
              height={Math.max(0, padding.top + innerHeight - y(target))}
            />
          </clipPath>
        </defs>
        <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} fill="#fdf4f6" />
        {elevationTicks.map((value) => (
          <g key={`y-${value}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(value)}
              y2={y(value)}
              stroke="#e4dfd8"
              strokeWidth="0.6"
            />
            <text x={padding.left - 4} y={y(value) + 3} textAnchor="end" fontSize="7" fill="#6b7a80">
              {num(value, 0)}
            </text>
          </g>
        ))}

        {/* camada de CORTE (acima da cota de projeto) */}
        <path d={areaPath} fill="#8c2f43" opacity="0.42" clipPath={`url(#cut-${tone})`} />
        {/* camada de TERRENO/Aterro (abaixo da cota de projeto) */}
        <path d={areaPath} fill="#1c5a6b" opacity="0.2" clipPath={`url(#fill-${tone})`} />
        <path d={linePath} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 2" />
        <path d={linePath} fill="none" stroke="#0b2a35" strokeWidth="0.7" opacity="0.3" />

        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={y(target)}
          y2={y(target)}
          stroke="#a8465c"
          strokeWidth="0.8"
          strokeDasharray="4 3"
          opacity="0.8"
        />
        <text x={width - padding.right - 2} y={y(target) - 2} textAnchor="end" fontSize="6.5" fill="#8c2f43">
          cota projeto {num(target, 1)} m
        </text>

        {distanceTicks.map((value) => (
          <text key={`x-${value}`} x={x(value)} y={height - 8} textAnchor="middle" fontSize="7" fill="#6b7a80">
            {num(value, 0)} m
          </text>
        ))}
        <text x={padding.left} y={height - 8} textAnchor="start" fontSize="7" fill="#6b7a80">
          início
        </text>
        <text x={width - padding.right} y={height - 8} textAnchor="end" fontSize="7" fill="#6b7a80">
          fim
        </text>
      </svg>

      <p className="px-2.5 pb-1.5 text-[7.5px] leading-snug text-muted">
        Amostragem direta no SRTM 30 m ao longo do eixo (mesma base usada pelo Google Earth) · maior{" "}
        {num(profile.highest.elevation, 1)} m · menor {num(profile.lowest.elevation, 1)} m · {profile.source}
      </p>
    </div>
  );
}

export function TerrainProfileChart({
  profile,
  crossProfile,
  height = 170,
}: {
  profile: TerrainProfile;
  crossProfile?: TerrainProfile | null;
  height?: number;
}) {
  return (
    <div className="grid gap-2 lg:grid-cols-2">
      <ElevationProfileChart profile={profile} height={height} tone="comprimento" />
      {crossProfile ? (
        <ElevationProfileChart profile={crossProfile} height={height} tone="largura" />
      ) : (
        <p className="rounded-lg bg-paper/70 px-3 py-2 text-[10px] text-muted">
          Perfil de largura será gerado ao reprocessar a análise.
        </p>
      )}
    </div>
  );
}
