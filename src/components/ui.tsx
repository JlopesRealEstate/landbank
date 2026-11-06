import type { ReactNode } from "react";
import type { City } from "@/db/schema";
import { distanceKm } from "@/lib/geo";
import { CITY_SEED } from "@/lib/cities";
import { MINIMUM_WAGE } from "@/lib/minimum-wage";
import { KIND_LABELS, STATUS_LABELS, STATUS_STYLES, brl, num } from "@/lib/format";

export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  id,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      id={id}
      className={cn("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(11,30,24,0.05)]", className)}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em] text-muted", className)}>{children}</p>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow className="mb-2">{eyebrow}</Eyebrow> : null}
        <h2 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        STATUS_STYLES[status] ?? "border-line bg-paper text-muted",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft">
      {KIND_LABELS[kind] ?? kind}
    </span>
  );
}

export function ScorePill({ score, grade }: { score: number; grade?: string }) {
  const tone =
    score >= 82
      ? "bg-leaf text-white border-leaf"
      : score >= 70
        ? "bg-leaf-50 text-leaf-600 border-emerald-200"
        : score >= 58
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-stone-100 text-stone-600 border-stone-300";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", tone)}>
      <span className="tabular-nums">{score}</span>
      <span className="opacity-70">/100</span>
      {grade ? <span className="hidden font-medium opacity-80 sm:inline">· {grade}</span> : null}
    </span>
  );
}

export function ScoreRing({ score, size = 76 }: { score: number; size?: number }) {
  const radius = size / 2 - 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const stroke = score >= 82 ? "#154a58" : score >= 70 ? "#1c5a6b" : score >= 58 ? "#a8465c" : "#8b8578";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#ece9dd" strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink"
        style={{ fontSize: size * 0.26, fontWeight: 700 }}
      >
        {score}
      </text>
    </svg>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "light",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "light" | "dark" | "lime";
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:p-5",
        tone === "dark" && "border-forest-600 bg-forest text-white",
        tone === "lime" && "border-lime bg-lime-soft text-ink",
        tone === "light" && "border-line bg-white text-ink",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-[10px] font-semibold uppercase tracking-[0.16em]", tone === "dark" ? "text-white/60" : "text-muted")}>
          {label}
        </p>
        {icon ? <span className={cn("opacity-60", tone === "dark" && "text-[#e9b7c1]")}>{icon}</span> : null}
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-[26px]">{value}</p>
        {sub ? <p className={cn("mt-1 text-xs", tone === "dark" ? "text-white/60" : "text-muted")}>{sub}</p> : null}
      </div>
    </div>
  );
}

export function MetricRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-2 last:border-0">
      <div>
        <p className="text-xs text-muted">{label}</p>
        {hint ? <p className="text-[10px] text-muted/80">{hint}</p> : null}
      </div>
      <p className="text-right text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export function Bar({ value, max, tone = "leaf" }: { value: number; max: number; tone?: "leaf" | "amber" | "lime" }) {
  const pct = max > 0 ? Math.min(100, Math.max(2, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
      <div
        className={cn("h-full rounded-full", tone === "leaf" && "bg-leaf", tone === "amber" && "bg-amber-500", tone === "lime" && "bg-lime")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CityIndicators({ city, point }: { city: City; point?: { lat: number; lng: number } }) {
  const density = city.areaKm2 > 0 ? city.population2022 / city.areaKm2 : 0;
  const formalWages = city.formalMinWages ?? 0;
  const formalSalary = city.formalAvgSalary ?? 0;
  const growth =
    city.population2010 > 0 ? ((city.population2022 - city.population2010) / city.population2010) * 100 : 0;
  const hasIndicators = city.population2022 > 0;
  const orDash = (value: string) => (hasIndicators ? value : "—");
  const hubs = CITY_SEED.filter((seed) => ["sumare", "campinas", "piracicaba"].includes(seed.slug));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "População (2022)", value: orDash(num(city.population2022)), hint: hasIndicators ? `${num(city.population2010)} em 2010` : "aguardando sincronização" },
          { label: "Crescimento 2010–22", value: orDash(`${growth >= 0 ? "+" : ""}${num(growth)}%`), hint: "IBGE Censo" },
          { label: "Renda média (domiciliar)", value: orDash(brl(city.avgIncome)), hint: "IBGE Censo 2022 · per capita" },
          {
            label: "Salário formal",
            value: formalWages > 0 ? `${num(formalWages, 2)} sal. mín.` : "—",
            hint: formalSalary > 0 ? `${brl(formalSalary)} · piso SP ${brl(MINIMUM_WAGE.value)}` : "IBGE CEMPRE 2023",
          },
          { label: "IDHM", value: orDash(city.idhm ? city.idhm.toFixed(3) : "—"), hint: "PNUD 2010" },
          { label: "PIB per capita", value: orDash(city.gdpPerCapita ? brl(city.gdpPerCapita) : "—"), hint: "IBGE Cidades" },
          { label: "Densidade", value: orDash(city.areaKm2 ? `${num(density)} hab/km²` : "—"), hint: city.areaKm2 ? `${num(city.areaKm2)} km²` : "área territorial n/d" },
          { label: "Urbanização", value: orDash(city.urbanization ? `${num(city.urbanization)}%` : "—"), hint: "grau de urbanização" },
          { label: "Benchmark solo", value: "Pendente de aferição", hint: "aguarda comparáveis auditáveis" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-paper/60 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
            <p className="mt-1.5 text-sm font-semibold tabular-nums text-ink">{item.value}</p>
            <p className="mt-0.5 text-[10px] text-muted">{item.hint}</p>
          </div>
        ))}
      </div>

      {!hasIndicators ? (
        <div className="rounded-xl border border-dashed border-line bg-paper/50 p-2.5 text-[10px] leading-relaxed text-muted">
          <strong className="text-ink-soft">Código IBGE {city.ibgeCode}</strong> — município disponível no cadastro (base
          completa do Estado de São Paulo). População, renda e IDHM são carregados na sincronização com o IBGE
          (<code>POST /api/ibge/sync</code>); enquanto isso, os indicadores aparecem como indisponíveis.
        </div>
      ) : null}
      <div className="rounded-xl border border-line bg-white p-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Vocação econômica</p>
        <p className="mt-1 text-xs text-ink-soft">{city.topSectors || "Vocação econômica a ser detalhada pelo time de inteligência."}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {city.highlights.map((highlight) => (
            <span
              key={highlight.label}
              className="rounded-full border border-line bg-paper px-2.5 py-1 text-[10px] text-ink-soft"
              title={highlight.value}
            >
              <strong className="font-semibold text-ink">{highlight.label}:</strong> {highlight.value}
            </span>
          ))}
        </div>
      </div>

      {point ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          {hubs.map((hub) => (
            <div key={hub.slug} className="rounded-xl border border-line bg-paper/60 px-2 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-muted">até {hub.name}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                {num(distanceKm(point, { lat: hub.lat, lng: hub.lng }), 1)} km
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-[10px] leading-relaxed text-muted">
        Fonte: IBGE — Censo 2022 (população e renda domiciliar), CEMPRE 2023 (salário médio mensal dos trabalhadores
        formais, em salários mínimos), PIB municipal (IBGE Cidades) e PNUD (IDHM 2010). Conversão do salário formal pelo
        piso regional paulista vigente de {brl(MINIMUM_WAGE.value)} ({MINIMUM_WAGE.law}). Benchmark de solo é referência
        interna Land Bank Corp.
      </p>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-leaf-50 text-leaf">◎</div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-md text-xs text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Marca Land Bank Corp — esfera vermelha com monograma "E" itálico azul,
 * contorno branco de separação, gradientes e sombra suave (recriação vetorial
 * fiel do logotipo oficial). Escala sem perda de nitidez.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-9 w-9", className)} aria-hidden focusable="false">
      <defs>
        <radialGradient id="lbcRed" cx="15" cy="13" r="27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fb5056" />
          <stop offset="0.38" stopColor="#e1121e" />
          <stop offset="0.78" stopColor="#bf0c17" />
          <stop offset="1" stopColor="#890710" />
        </radialGradient>
        <linearGradient id="lbcBlue" x1="21" y1="10" x2="40" y2="37" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#66b2f5" />
          <stop offset="0.33" stopColor="#3f8ee1" />
          <stop offset="0.66" stopColor="#236ac1" />
          <stop offset="1" stopColor="#114084" />
        </linearGradient>
        <filter id="lbcShadow" x="-30%" y="-25%" width="168%" height="175%">
          <feDropShadow dx="0" dy="0.9" stdDeviation="1.1" floodColor="#1a1a1a" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#lbcShadow)">
        <circle cx="21.4" cy="24" r="19.4" fill="url(#lbcRed)" />
        <g transform="skewX(-10)">
          <path
            d="M20.4 10.2 H38.6 L36.5 15.4 H25.9 L24.4 20.2 H33.7 L31.7 25.2 H22.6 L21.1 29.9 H39.1 L36.9 35.1 H17.0 C16.0 26.6 17.5 17.8 20.4 10.2 Z"
            fill="#ffffff"
            stroke="#ffffff"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path
            d="M20.4 10.2 H38.6 L36.5 15.4 H25.9 L24.4 20.2 H33.7 L31.7 25.2 H22.6 L21.1 29.9 H39.1 L36.9 35.1 H17.0 C16.0 26.6 17.5 17.8 20.4 10.2 Z"
            fill="url(#lbcBlue)"
            stroke="url(#lbcBlue)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}
