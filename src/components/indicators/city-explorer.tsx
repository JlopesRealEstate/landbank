"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Building2, Database, MapPin, Search, TrendingUp } from "lucide-react";
import type { City } from "@/db/schema";
import { brl, num } from "@/lib/format";
import { Bar, Card, CityIndicators, Eyebrow, StatusBadge, cn } from "@/components/ui";

export type CityAreaSummary = {
  id: number;
  code: string;
  name: string;
  status: string;
  landAreaM2: number;
  pricePerM2: number;
  totalPrice: number;
};

export function CityExplorer({
  cities,
  areasByCity,
}: {
  cities: City[];
  areasByCity: Record<string, CityAreaSummary[]>;
}) {
  const withPortfolio = useMemo(
    () => [...cities].sort((a, b) => (areasByCity[b.slug]?.length ?? 0) - (areasByCity[a.slug]?.length ?? 0)),
    [cities, areasByCity],
  );
  const [selected, setSelected] = useState(withPortfolio[0]?.slug ?? "");
  const [query, setQuery] = useState("");

  const filtered = withPortfolio.filter((city) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return `${city.name} ${city.region}`.toLowerCase().includes(term);
  });

  const city = cities.find((item) => item.slug === selected) ?? withPortfolio[0];
  const cityAreas = city ? areasByCity[city.slug] ?? [] : [];
  const growth =
    city && city.population2010 > 0 ? ((city.population2022 - city.population2010) / city.population2010) * 100 : 0;
  const avgPrice = cityAreas.length ? cityAreas.reduce((sum, area) => sum + area.pricePerM2, 0) / cityAreas.length : 0;
  const maxPopulation = Math.max(...cities.map((item) => item.population2022), 1);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="flex max-h-[720px] flex-col overflow-hidden">
        <div className="border-b border-line p-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper/60 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar município"
              className="w-full bg-transparent text-[11px] outline-none placeholder:text-muted/70"
            />
          </div>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto">
          {filtered.map((item) => {
            const count = areasByCity[item.slug]?.length ?? 0;
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => setSelected(item.slug)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border-b border-line/60 px-3 py-2 text-left transition hover:bg-paper/70",
                  city?.slug === item.slug && "bg-lime-soft/60",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-ink">{item.name}</span>
                  <span className="block truncate text-[9px] text-muted">{item.region}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold",
                    count > 0 ? "bg-forest text-[#e9b7c1]" : "bg-paper text-muted",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {city ? (
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Eyebrow>{city.region}</Eyebrow>
                <h2 className="mt-1 text-xl font-semibold">{city.name}</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> São Paulo · código IBGE {city.ibgeCode}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Database className="h-3 w-3" /> {city.source}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl bg-forest px-3 py-2 text-white">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-white/50">Ativos no land bank</p>
                  <p className="text-lg font-semibold tabular-nums">{cityAreas.length}</p>
                </div>
                <div className="rounded-xl bg-paper px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-muted">R$/m² médio do portfólio</p>
                  <p className="text-lg font-semibold tabular-nums">{avgPrice ? brl(avgPrice) : "—"}</p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <CityIndicators city={city} />
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-leaf" />
                <h3 className="text-sm font-semibold">Crescimento populacional</h3>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {growth >= 0 ? "+" : ""}
                {num(growth)}%
              </p>
              <p className="text-[10px] text-muted">
                {num(city.population2010)} hab (2010) → {num(city.population2022)} hab (2022)
              </p>
              <div className="mt-3 space-y-2">
                <div>
                  <div className="flex justify-between text-[9px] text-muted">
                    <span>Censo 2010</span>
                    <span>{num((city.population2010 / maxPopulation) * 100)}% do maior município da base</span>
                  </div>
                  <Bar value={city.population2010} max={maxPopulation} />
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-muted">
                    <span>Censo 2022</span>
                    <span>{num((city.population2022 / maxPopulation) * 100)}%</span>
                  </div>
                  <Bar value={city.population2022} max={maxPopulation} />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-leaf" />
                <h3 className="text-sm font-semibold">Ativos neste município</h3>
              </div>
              {cityAreas.length === 0 ? (
                <p className="mt-2 rounded-lg bg-paper/60 p-2.5 text-[11px] text-muted">
                  Nenhum ativo cadastrado. Utilize a base IBGE para avaliar novas oportunidades de land bank.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {cityAreas.map((area) => (
                    <li key={area.id} className="flex items-center justify-between gap-2 py-1.5">
                      <div className="min-w-0">
                        <Link href={`/areas/${area.id}`} className="block truncate text-[11px] font-medium text-ink hover:text-leaf-600">
                          {area.name}
                        </Link>
                        <p className="text-[9px] text-muted">
                          {area.code} · {num(area.landAreaM2)} m² · {brl(area.pricePerM2)}/m²
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <StatusBadge status={area.status} />
                        <Link href={`/areas/${area.id}`} className="text-ink-soft hover:text-leaf-600">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
