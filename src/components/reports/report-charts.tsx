"use client";

import { brl, num } from "@/lib/format";

export type ChartDatum = { label: string; value: number; extra?: string };

const PALETTE = ["#0b2a35", "#154a58", "#1c5a6b", "#2c7a8c", "#8c2f43", "#a8465c", "#c4a5ab", "#6b7a80"];

export function BarChartH({
  data,
  format = "number",
  maxItems = 10,
}: {
  data: ChartDatum[];
  format?: "number" | "currency" | "area";
  maxItems?: number;
}) {
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map((item) => item.value), 1);
  const label = (value: number) =>
    format === "currency" ? brl(value, { compact: true }) : format === "area" ? `${num(value / 10_000, 1)} ha` : num(value);

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[11px] font-medium text-ink">{item.label}</p>
            <p className="shrink-0 text-[10px] font-semibold tabular-nums text-ink-soft">
              {label(item.value)}
              {item.extra ? <span className="ml-1 font-normal text-muted">{item.extra}</span> : null}
            </p>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-deep">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: PALETTE[index % PALETTE.length] }}
            />
          </div>
        </div>
      ))}
      {items.length === 0 ? <p className="text-[11px] text-muted">Sem dados para o filtro atual.</p> : null}
    </div>
  );
}

export function DonutChart({ data, unit = "ativos" }: { data: ChartDatum[]; unit?: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#ece9e2" strokeWidth="18" />
        {data.map((item, index) => {
          const fraction = total > 0 ? item.value / total : 0;
          const dash = fraction * circumference;
          const element = (
            <circle
              key={item.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={PALETTE[index % PALETTE.length]}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            />
          );
          offset += dash;
          return element;
        })}
        <text x="70" y="65" textAnchor="middle" className="fill-ink" style={{ fontSize: 20, fontWeight: 700 }}>
          {num(total)}
        </text>
        <text x="70" y="82" textAnchor="middle" className="fill-muted" style={{ fontSize: 9 }}>
          {unit}
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {data.map((item, index) => (
          <li key={item.label} className="flex items-center justify-between gap-2 text-[10px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: PALETTE[index % PALETTE.length] }} />
              <span className="truncate text-ink-soft">{item.label}</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">
              {num(item.value)}
              <span className="ml-1 font-normal text-muted">{total ? `${num((item.value / total) * 100)}%` : ""}</span>
            </span>
          </li>
        ))}
        {data.length === 0 ? <li className="text-[11px] text-muted">Sem dados.</li> : null}
      </ul>
    </div>
  );
}

export function ColumnChart({
  data,
  format = "currency",
}: {
  data: ChartDatum[];
  format?: "currency" | "number";
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const label = (value: number) => (format === "currency" ? brl(value, { compact: true }) : num(value));
  return (
    <div className="flex h-44 items-end gap-1.5">
      {data.map((item, index) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[8px] font-semibold tabular-nums text-ink-soft">{label(item.value)}</span>
          <div
            className="w-full rounded-t-md"
            style={{
              height: `${Math.max(3, (item.value / max) * 100)}%`,
              background: index === data.length - 1 ? "#8c2f43" : "#154a58",
              opacity: index === data.length - 1 ? 1 : 0.85,
            }}
            title={`${item.label}: ${label(item.value)}`}
          />
          <span className="w-full truncate text-center text-[8px] text-muted">{item.label}</span>
        </div>
      ))}
      {data.length === 0 ? <p className="text-[11px] text-muted">Sem dados.</p> : null}
    </div>
  );
}

export function ScatterChart({
  points,
}: {
  points: { x: number; y: number; label: string; kind: string }[];
}) {
  const maxX = Math.max(...points.map((point) => point.x), 1);
  const maxY = Math.max(...points.map((point) => point.y), 1);
  return (
    <div className="relative h-52 w-full rounded-lg border border-line bg-paper/40">
      <svg viewBox="0 0 320 200" className="h-full w-full">
        {[0, 1, 2, 3, 4].map((line) => (
          <line key={line} x1="0" x2="320" y1={line * 50} y2={line * 50} stroke="#e4e0d7" strokeWidth="0.6" />
        ))}
        {points.map((point) => {
          const cx = 10 + (point.x / maxX) * 300;
          const cy = 190 - (point.y / maxY) * 180;
          return (
            <g key={point.label}>
              <circle
                cx={cx}
                cy={cy}
                r={point.kind === "galpao" ? 5 : 4}
                fill={point.kind === "galpao" ? "#8c2f43" : "#154a58"}
                opacity="0.85"
              />
              <title>{`${point.label} · ${num(point.x)} m² · R$ ${num(point.y)}/m²`}</title>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-1 left-2 text-[8px] text-muted">área do terreno (m²) →</div>
      <div className="absolute left-1 top-1 text-[8px] text-muted">↑ R$/m²</div>
      <div className="absolute right-2 top-1 flex gap-2 text-[8px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#154a58]" /> terreno
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#8c2f43]" /> galpão
        </span>
      </div>
    </div>
  );
}
