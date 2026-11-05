"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Mountain, Play, RefreshCw, Trash2, TriangleAlert, Waves } from "lucide-react";
import type { GradingReport, TerrainHeatmap, TerrainProfile, TerrainStats } from "@/db/schema";
import { areaLabel, brl, num } from "@/lib/format";
import { cn } from "@/components/ui";
import { TerrainProfileChart } from "@/components/areas/terrain-profile-chart";
import { buildContours, cropGrid } from "@/lib/contour";
import { contourGradientCss } from "@/lib/contour-colors";
import { FieldHelp } from "@/components/ui/field-help";

export type TerrainAnalysis = {
  id: number;
  areaId: number;
  interval: number;
  bufferM: number;
  resolution: number;
  demSource: string;
  verticalOffset: number;
  source: string;
  scope: string;
  targetMode: string;
  targetElevation: number | null;
  contours: { elevation: number; coordinates: [number, number][]; kind: string; inside?: boolean }[];
  stats: TerrainStats;
  heatmap: TerrainHeatmap | null;
  cutFillHeatmap: TerrainHeatmap | null;
  profile: TerrainProfile | null;
  crossProfile: TerrainProfile | null;
  demGrid: {
    values: number[][];
    bounds: { north: number; south: number; east: number; west: number };
    innerValues: number[][];
    innerBounds: { north: number; south: number; east: number; west: number };
    polygonBounds: { north: number; south: number; east: number; west: number };
    boundary: [number, number][];
    min: number;
    max: number;
    bufferM: number;
  } | null;
  gridLines?: { coordinates: [number, number][]; kind: string }[] | null;
  gridInfo?: {
    columns: number;
    rows: number;
    cellLengthM: number;
    cellWidthM: number;
    cellAreaM2: number;
    cellCount: number;
    coveredAreaM2: number;
    coveragePct: number;
    lengthSpanM: number;
    widthSpanM: number;
    centerLat: number;
    centerLng: number;
    azimuth: number;
  } | null;
  demComparison:
    | {
        source: string;
        label: string;
        provider: string;
        resolution: string;
        live: boolean;
        samples: number;
        meanElevation: number;
        minElevation: number;
        maxElevation: number;
        meanAbsoluteDiff: number;
        bias: number;
        agreementPct: number;
      }[]
    | null;
  grading: GradingReport | null;
  viewConfig?: {
    contourScope?: "both" | "inside" | "around";
    showContours?: boolean;
    heatmapMode?: "elevation" | "cutfill";
    heatmapScope?: "both" | "inside" | "around";
    heatmapOpacity?: number;
  } | null;
  createdAt: string;
};

export type TerrainView = {
  contours: TerrainAnalysis["contours"];
  heatmap: TerrainHeatmap | null;
  cutFillHeatmap: TerrainHeatmap | null;
  contourScope: "both" | "inside" | "around";
  heatmapMode: "elevation" | "cutfill";
  heatmapScope: "both" | "inside" | "around";
  heatmapOpacity: number;
  profile?: TerrainProfile | null;
  crossProfile?: TerrainProfile | null;
  demComparison?: TerrainAnalysis["demComparison"];
};

const EQUIDISTANCE = [0.5, 1, 2, 5, 10, 20, 50];
const BUFFER_OPTIONS = [10, 50, 100, 200, 500];
const GRID_OPTIONS = [20, 30, 36, 42, 48];

const TARGET_MODES: { value: string; label: string }[] = [
  { value: "balance", label: "Equilíbrio de massas (recomendado)" },
  { value: "mean", label: "Cota média ponderada" },
  { value: "min", label: "Cota mínima (máximo aterro)" },
  { value: "max", label: "Cota máxima (máximo corte)" },
  { value: "manual", label: "Cota informada manualmente" },
];

function parseNumber(value: string): number | undefined {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (normalized === "" || normalized === "-") return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function TerrainPanel({
  areaId,
  onViewChange,
}: {
  areaId: number;
  onViewChange?: (view: TerrainView) => void;
}) {
  const [analysis, setAnalysis] = useState<TerrainAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // campos controlados como texto: permite digitar livremente (inclusive vírgula)
  const [intervalInput, setIntervalInput] = useState("0.5");
  const [bufferInput, setBufferInput] = useState("200");
  const [targetMode, setTargetMode] = useState("balance");
  const [targetInput, setTargetInput] = useState("");
  const [resolutionInput, setResolutionInput] = useState("30");
  const [demSource, setDemSource] = useState("srtm30m");
  const [verticalOffsetInput, setVerticalOffsetInput] = useState("0");

  const [contourScope, setContourScope] = useState<"both" | "inside" | "around">("inside");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [heatmapMode, setHeatmapMode] = useState<"elevation" | "cutfill">("elevation");
  const [heatmapScope, setHeatmapScope] = useState<"both" | "inside" | "around">("inside");
  const [opacity, setOpacity] = useState(60);
  const [redrawMs, setRedrawMs] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  function emit(partial: Partial<TerrainView> & { analysis?: TerrainAnalysis | null } = {}) {
    const current = partial.analysis !== undefined ? partial.analysis : analysis;
    const nextScope = partial.contourScope ?? contourScope;
    const nextHeatScope = partial.heatmapScope ?? heatmapScope;
    const nextMode = partial.heatmapMode ?? heatmapMode;
    const nextOpacity = partial.heatmapOpacity ?? opacity;
    const heatOn = partial.heatmap !== undefined ? partial.heatmap !== null : showHeatmap;
    onViewChange?.({
      contours: partial.contours !== undefined ? partial.contours : current?.contours ?? [],
      heatmap: heatOn ? partial.heatmap !== undefined ? partial.heatmap : current?.heatmap ?? null : null,
      cutFillHeatmap:
        partial.cutFillHeatmap !== undefined ? partial.cutFillHeatmap : current?.cutFillHeatmap ?? null,
      contourScope: nextScope,
      heatmapMode: nextMode,
      heatmapScope: nextHeatScope,
      heatmapOpacity: nextOpacity,
      profile: current?.profile ?? null,
      crossProfile: current?.crossProfile ?? null,
      demComparison: current?.demComparison,
    });
  }

  const signature = `${intervalInput}|${bufferInput}|${targetMode}|${targetInput}|${resolutionInput}|${demSource}|${verticalOffsetInput}`;
  const signatureRef = useRef<string>("");
  const geometryRef = useRef<string>("");
  const geometrySignature = `${intervalInput}|${bufferInput}`;
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  function applyAnalysis(next: TerrainAnalysis) {
    setAnalysis(next);
    setResolutionInput(String(next.resolution || 30));
    emit({ analysis: next });
  }

  /**
   * Redesenho INSTANTÂNEO: equidistância e entorno são recalculados no navegador
   * a partir da grade de elevação já amostrada — sem nova consulta ao servidor.
   */
  function redrawLocal(nextInterval: number, nextBuffer: number) {
    const source = analysis;
    const grid = source?.demGrid;
    if (!source || !grid || !grid.innerValues || !grid.innerBounds) return false;

    const step = Math.min(50, Math.max(0.5, nextInterval));
    const indexInterval = step <= 1 ? step * 5 : step <= 5 ? step * 2 : step * 5;
    const cropped = cropGrid(grid.values, grid.bounds, Math.max(10, nextBuffer), grid.polygonBounds);

    const started = performance.now();
    const insideContoursRaw = buildContours({
      grid: grid.innerValues,
      bounds: grid.innerBounds,
      boundary: grid.boundary,
      interval: step,
      indexInterval,
      minElevation: grid.min,
      maxElevation: grid.max,
    }).filter((contour) => contour.inside);
    const aroundContoursRaw = buildContours({
      grid: cropped.grid,
      bounds: cropped.bounds,
      boundary: grid.boundary,
      interval: step,
      indexInterval,
      minElevation: grid.min,
      maxElevation: grid.max,
    }).filter((contour) => !contour.inside);
    const contours = [...insideContoursRaw, ...aroundContoursRaw].map((contour) => ({
      ...contour,
      kind: (Math.abs(contour.elevation % indexInterval) < 1e-6 ? "index" : "intermediate") as "index" | "intermediate",
    }));
    const elapsed = Math.round(performance.now() - started);

    const stats = {
      ...source.stats,
      contourCount: contours.length,
      insideContours: contours.filter((item) => item.inside).length,
      aroundContours: contours.filter((item) => !item.inside).length,
      contourSegments: contours.reduce((sum, item) => sum + Math.max(0, item.coordinates.length - 1), 0),
      effectiveInterval: step,
    };

    setAnalysis({ ...source, interval: step, bufferM: nextBuffer, contours, stats });
    setRedrawMs(elapsed);
    onViewChange?.({
      contours,
      heatmap: source.heatmap,
      cutFillHeatmap: source.cutFillHeatmap,
      contourScope,
      heatmapMode,
      heatmapScope,
      heatmapOpacity: opacity,
      profile: source.profile,
      crossProfile: source.crossProfile,
      demComparison: source.demComparison,
    });
    return true;
  }

  // grava a configuração de exibição (curvas / calor / opacidade) sempre que mudar
  const persistView = useRef<ReturnType<typeof setTimeout> | null>(null);
  function persist(next: {
    contourScope?: "both" | "inside" | "around";
    showContours?: boolean;
    heatmapMode?: "elevation" | "cutfill";
    heatmapScope?: "both" | "inside" | "around";
    heatmapOpacity?: number;
  }) {
    if (persistView.current) clearTimeout(persistView.current);
    persistView.current = setTimeout(() => {
      void fetch(`/api/areas/${areaId}/terrain`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => undefined);
    }, 450);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/areas/${areaId}/terrain`)
      .then((response) => response.json())
      .then((data: { ok: boolean; analysis: TerrainAnalysis | null }) => {
        if (!active || !data.ok) return;
        setAnalysis(data.analysis);
        if (data.analysis) {
          const saved = data.analysis;
          setIntervalInput(String(saved.interval));
          setBufferInput(String(saved.bufferM));
          setTargetMode(saved.targetMode || "balance");
          setTargetInput(saved.grading ? String(saved.grading.targetElevation) : "");
          setResolutionInput(String(saved.resolution || 30));
          setDemSource(saved.demSource || "srtm30m");
          setVerticalOffsetInput(String(saved.verticalOffset ?? 0));
          const view = saved.viewConfig;
          if (view) {
            setContourScope(view.contourScope ?? "inside");
            setShowContours(view.showContours !== false);
            setShowHeatmap(true);
            setHeatmapMode(view.heatmapMode ?? "elevation");
            setHeatmapScope(view.heatmapScope ?? "inside");
            setOpacity(view.heatmapOpacity ?? 60);
          }
          geometryRef.current = `${saved.interval}|${saved.bufferM}`;
          signatureRef.current = `${saved.interval}|${saved.bufferM}|${saved.targetMode}|${saved.grading ? saved.grading.targetElevation : ""}|${saved.resolution || 30}|${saved.demSource || "srtm30m"}|${saved.verticalOffset ?? 0}`;
          emit({ analysis: saved });
        }
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaId]);

  /** Reprocessa automaticamente (interativo) quando qualquer parâmetro muda. */
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (loading) return;
    if (!analysis) return; // primeira análise precisa do botão
    if (geometrySignature !== geometryRef.current) {
      // equidistância / entorno → redesenho instantâneo, sem recalcular a análise
      redrawLocal(Number(intervalInput) || 0.5, Number(bufferInput) || 200);
      geometryRef.current = geometrySignature;
      signatureRef.current = signature;
      return;
    }
    if (signature === signatureRef.current) return;
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      void generate(true);
    }, 650);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, loading, analysis]);

  async function generate(auto = false) {
    setGenerating(true);
    if (!auto) setError(null);
    try {
      const interval = parseNumber(intervalInput);
      const bufferM = parseNumber(bufferInput);
      const target = parseNumber(targetInput);
      if (interval === undefined) throw new Error("Informe a equidistância das curvas (ex.: 1, 2, 5 ou 10 m).");
      if (bufferM === undefined) throw new Error("Informe o raio do entorno em metros (ex.: 250).");
      if (targetMode === "manual" && target === undefined) {
        throw new Error("Para cota manual, informe a cota de projeto em metros (ex.: 580,50).");
      }

      const response = await fetch(`/api/areas/${areaId}/terrain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval,
          bufferM,
          targetMode,
          targetElevation: targetMode === "manual" ? target : undefined,
          resolution: parseNumber(resolutionInput),
          demSource,
          verticalOffset: parseNumber(verticalOffsetInput) ?? 0,
          viewConfig: {
            contourScope,
            showContours: true,
            heatmapMode,
            heatmapScope,
            heatmapOpacity: opacity,
          },
        }),
      });
      const data = (await response.json()) as { ok: boolean; analysis?: TerrainAnalysis; error?: string };
      if (!response.ok || !data.ok || !data.analysis) throw new Error(data.error ?? "Falha ao gerar a análise.");
      signatureRef.current = signature;
      geometryRef.current = geometrySignature;
      applyAnalysis(data.analysis);
      setShowHeatmap(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao gerar a análise.");
    } finally {
      setGenerating(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remover a análise topográfica e o parecer de terraplenagem deste imóvel?")) return;
    await fetch(`/api/areas/${areaId}/terrain`, { method: "DELETE" });
    setAnalysis(null);
    onViewChange?.({
      contours: [],
      heatmap: null,
      cutFillHeatmap: null,
      contourScope,
      heatmapMode,
      heatmapScope,
      heatmapOpacity: opacity,
    });
  }

  const stats = analysis?.stats;
  const grading = analysis?.grading;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f6e8eb] text-[#8c2f43]">
            <Waves className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink">Topografia: curvas de nível, mapa de calor e terraplenagem</p>
            <p className="text-[10px] text-muted">
              Amostragem SRTM 30 m dentro da demarcação do KMZ e no entorno.
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2 py-0.5 text-[9px] font-semibold text-leaf-600">
              {generating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
              {generating
                ? "recalculando análise…"
                : redrawMs !== null
                  ? `curvas redesenhadas em ${redrawMs} ms (sem recalcular)`
                  : "equidistância e entorno redesenham na hora"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-2 text-[10px] font-medium text-ink-soft hover:border-[#8c2f43] hover:text-[#8c2f43]"
            aria-expanded={open}
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {open ? "Recolher" : "Expandir"}
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[10px] font-semibold text-white hover:bg-forest-600 disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : analysis ? <RefreshCw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {generating ? "Redesenhando…" : analysis ? "Recalcular agora" : "Processar análise"}
          </button>
          {analysis ? (
            <button
              type="button"
              onClick={() => void remove()}
              className="rounded-lg border border-line p-1.5 text-muted hover:border-[#8c2f43] hover:text-[#8c2f43]"
              title="Remover análise"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
      <>
      <div className="grid gap-2 rounded-xl border border-line bg-paper/50 p-2.5 sm:grid-cols-2 lg:grid-cols-6">
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Equidistância (m) <FieldHelp helpKey="terreno.interval" label="Equidistância" /></span>
          <select
            value={EQUIDISTANCE.includes(Number(intervalInput)) ? intervalInput : "0.5"}
            onChange={(event) => setIntervalInput(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] tabular-nums outline-none focus:border-leaf"
          >
            {EQUIDISTANCE.map((value) => (
              <option key={value} value={String(value)}>
                {value.toLocaleString("pt-BR")} m
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-[8px] text-muted">curvas calculadas automaticamente</span>
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Entorno (m) <FieldHelp helpKey="terreno.buffer" label="Entorno" /></span>
          <select
            value={BUFFER_OPTIONS.includes(Number(bufferInput)) ? bufferInput : "200"}
            onChange={(event) => setBufferInput(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] tabular-nums outline-none focus:border-leaf"
          >
            {BUFFER_OPTIONS.map((value) => (
              <option key={value} value={String(value)}>
                {value} m
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-[8px] text-muted">faixa analisada ao redor do KMZ</span>
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Critério da cota <FieldHelp helpKey="terreno.targetMode" label="Critério da cota" /></span>
          <select
            value={targetMode}
            onChange={(event) => setTargetMode(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] outline-none focus:border-leaf"
          >
            {TARGET_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-[8px] text-muted">como definir a cota de projeto</span>
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Fonte do perfil <FieldHelp helpKey="terreno.demSource" label="Fonte topográfica" /></span>
          <select
            value={demSource}
            onChange={(event) => setDemSource(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] outline-none focus:border-leaf"
          >
            <option value="srtm30m">SRTM 30 m</option>
            <option value="copernicus">Copernicus GLO-90</option>
            <option value="aster30m">ASTER 30 m</option>
          </select>
          <span className="mt-0.5 block text-[8px] text-muted">MDE usado nos dois perfis</span>
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Ajuste vertical (m) <FieldHelp helpKey="terreno.verticalOffset" label="Ajuste vertical" /></span>
          <input
            type="text"
            inputMode="decimal"
            value={verticalOffsetInput}
            onChange={(event) => setVerticalOffsetInput(event.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] tabular-nums outline-none focus:border-leaf"
          />
          <span className="mt-0.5 block text-[8px] text-muted">calibração contra o Google Earth</span>
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Cota do projeto (m) <FieldHelp helpKey="terreno.targetElevation" label="Cota do projeto" /></span>
          <input
            type="text"
            inputMode="decimal"
            value={targetInput}
            disabled={targetMode !== "manual"}
            onChange={(event) => setTargetInput(event.target.value)}
            placeholder={grading ? num(grading.targetElevation, 2) : "automática"}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] tabular-nums outline-none focus:border-leaf disabled:bg-paper-deep/60 disabled:text-muted"
          />
          <span className="mt-0.5 block text-[8px] text-muted">
            {targetMode === "manual" ? "edite a cota desejada" : "definida pelo critério selecionado"}
          </span>
        </label>
        <label className="block">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Resolução da grade <FieldHelp helpKey="terreno.resolution" label="Resolução da grade" /></span>
          <select
            value={String(Number(resolutionInput) || 30)}
            onChange={(event) => setResolutionInput(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] outline-none focus:border-leaf"
          >
            {GRID_OPTIONS.map((value) => (
              <option key={value} value={String(value)}>
                {value} × {value}
                {value === 30 ? " (padrão)" : value === 48 ? " (máxima)" : ""}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-[8px] text-muted">
            aplicado: {stats?.gridRows ?? "—"}×{stats?.gridCols ?? "—"}
          </span>
        </label>
      </div>

      <div className="grid gap-2 rounded-xl border border-line bg-white p-2.5 sm:grid-cols-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Exibir curvas de nível <FieldHelp helpKey="terreno.contourScope" label="Exibir curvas" /></p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(
              [
                { value: "both", label: "Dentro + entorno" },
                { value: "inside", label: "Somente dentro do KMZ" },
                { value: "around", label: "Somente entorno" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setContourScope(option.value);
                  emit({ contourScope: option.value });
                  persist({ contourScope: option.value });
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                  contourScope === option.value
                    ? "border-leaf bg-leaf-50 text-leaf-600"
                    : "border-line bg-white text-muted hover:border-leaf/50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Mapa de calor <FieldHelp helpKey="terreno.heatmap" label="Mapa de calor" /></p>
            <label className="flex items-center gap-1 text-[9px] text-ink-soft">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(event) => {
                  setShowHeatmap(event.target.checked);
                  emit({ heatmap: event.target.checked ? analysis?.heatmap ?? null : null });
                  persist({ heatmapOpacity: opacity });
                }}
                className="h-3 w-3 accent-[#8c2f43]"
              />
              ativo
            </label>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <select
              value={heatmapMode}
              onChange={(event) => {
                const mode = event.target.value as "elevation" | "cutfill";
                setHeatmapMode(mode);
                emit({ heatmapMode: mode });
                persist({ heatmapMode: mode });
              }}
              className="rounded-lg border border-line bg-white px-2 py-1 text-[10px]"
            >
              <option value="elevation">Cotas do terreno</option>
              <option value="cutfill">Corte (bordô) × aterro (petróleo)</option>
            </select>
            {(
              [
                { value: "both", label: "Dentro + entorno" },
                { value: "inside", label: "Dentro do KMZ" },
                { value: "around", label: "Entorno" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setHeatmapScope(option.value);
                  emit({ heatmapScope: option.value });
                  persist({ heatmapScope: option.value });
                }}
                className={cn(
                  "rounded-full border px-2 py-1 text-[10px] font-medium transition",
                  heatmapScope === option.value
                    ? "border-[#8c2f43] bg-[#f6e8eb] text-[#8c2f43]"
                    : "border-line bg-white text-muted hover:border-[#8c2f43]/50",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-[9px] text-muted">opacidade</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={opacity}
              onChange={(event) => {
                const value = Number(event.target.value);
                setOpacity(value);
                emit({ heatmapOpacity: value });
                persist({ heatmapOpacity: value });
              }}
              className="h-1 flex-1 accent-[#8c2f43]"
            />
            <span className="w-8 text-right text-[9px] font-semibold tabular-nums text-ink-soft">{opacity}%</span>
          </div>
          {analysis ? (
            <div className="mt-1.5">
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#1c5a6b] via-[#c8c8a0] to-[#8c2f43]" />
              <div className="mt-0.5 flex justify-between text-[8px] tabular-nums text-muted">
                {heatmapMode === "elevation" ? (
                  <>
                    <span>{num(analysis.heatmap?.min ?? 0, 1)} m</span>
                    <span>cotas do terreno</span>
                    <span>{num(analysis.heatmap?.max ?? 0, 1)} m</span>
                  </>
                ) : (
                  <>
                    <span>aterro {num(analysis.cutFillHeatmap?.min ?? 0, 1)} m</span>
                    <span>cota de projeto</span>
                    <span>corte +{num(analysis.cutFillHeatmap?.max ?? 0, 1)} m</span>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-[#f6e8eb] px-2.5 py-2 text-[10px] text-[#8c2f43]">
          <TriangleAlert className="mr-1 inline h-3 w-3" /> {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg bg-paper/70 px-3 py-2 text-[10px] text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Verificando análise existente…
        </div>
      ) : generating ? (
        <div className="flex items-center gap-2 rounded-lg bg-leaf-50 px-3 py-2 text-[10px] text-leaf-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          Amostrando cotas SRTM, traçando curvas com recorte exato no KMZ e integrando volumes de corte/aterro…
        </div>
      ) : analysis && stats ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "Cota mínima", value: `${num(stats.minElevation, 1)} m` },
              { label: "Cota máxima", value: `${num(stats.maxElevation, 1)} m` },
              { label: "Amplitude", value: `${num(stats.rangeM, 1)} m` },
              { label: "Declividade média", value: `${num(stats.slopePct, 2)}%` },
              { label: "Curvas no KMZ", value: num(stats.insideContours ?? 0) },
              { label: "Curvas no entorno", value: num(stats.aroundContours ?? 0) },
              { label: "Trechos de curva", value: num(stats.contourSegments ?? 0) },
              { label: "Área do KMZ", value: `${num(stats.geodesicAreaM2 ?? 0)} m²` },
              { label: "Área do KMZ (ha)", value: `${num((stats.geodesicAreaM2 ?? 0) / 10000, 2)} ha` },
              { label: "Área estudada (KMZ + entorno)", value: `${num(stats.studiedAreaM2 ?? 0)} m²` },
              { label: "Área do entorno", value: `${num(stats.aroundAreaM2 ?? 0)} m²` },
              { label: "Área integrada", value: `${num(stats.integrationAreaM2 ?? 0)} m²` },
              { label: "Diferença de área", value: `${num(stats.areaErrorPct ?? 0, 2)}%` },
              { label: "Intervalo aplicado", value: `${num(stats.effectiveInterval ?? analysis.interval, 2)} m` },
              { label: "Entorno aplicado", value: `${num(analysis.bufferM)} m` },
              { label: "Grade", value: `${num(stats.gridRows ?? 0)}×${num(stats.gridCols ?? 0)}` },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-line bg-paper/50 px-2 py-1.5">
                <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p>
                <p className="text-[11px] font-semibold tabular-nums text-ink">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper/60 px-2.5 py-1.5 text-[10px]">
            <p className="text-muted">
              Fonte <strong className="text-ink-soft">{analysis.source}</strong> · {num(stats.contourSegments ?? 0)} trechos ·{" "}
              {areaLabel(stats.geodesicAreaM2 ?? 0)} · {new Date(analysis.createdAt).toLocaleString("pt-BR")}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted">
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-5 bg-[#0b2a35]" /> mestra ({num(stats.indexInterval, 1)} m)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-5 border-t border-dashed border-[#0b2a35]" /> intermediária
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-16 rounded-full" style={{ background: contourGradientCss() }} />
                cota baixa → alta
              </span>
            </div>
          </div>

          {analysis.profile ? (
            <TerrainProfileChart profile={analysis.profile} crossProfile={analysis.crossProfile} />
          ) : null}

          {analysis.demComparison?.length ? (
            <div className="rounded-xl border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/50 px-2.5 py-2">
                <p className="text-[11px] font-semibold text-ink">Comparativo de fontes topográficas (MDE)</p>
                <p className="text-[8px] text-muted">mesmas coordenadas dos transectos · diferença em metros</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[10px]">
                  <thead className="bg-paper/60 text-[8px] uppercase tracking-[0.08em] text-muted">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Fonte</th>
                      <th className="px-2 py-1.5 font-semibold">Resolução</th>
                      <th className="px-2 py-1.5 font-semibold">Cota média</th>
                      <th className="px-2 py-1.5 font-semibold">Faixa</th>
                      <th className="px-2 py-1.5 font-semibold">Δ médio vs. SRTM</th>
                      <th className="px-2 py-1.5 font-semibold">Viés</th>
                      <th className="px-2.5 py-1.5 font-semibold">Concordância</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {analysis.demComparison.map((source) => (
                      <tr key={source.source}>
                        <td className="px-2.5 py-1.5">
                          <p className="font-medium text-ink">{source.label}</p>
                          <p className="text-[8px] text-muted">{source.provider}</p>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{source.resolution}</td>
                        <td className="px-2 py-1.5 tabular-nums">{source.live ? `${num(source.meanElevation, 1)} m` : "—"}</td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {source.live ? `${num(source.minElevation, 1)}–${num(source.maxElevation, 1)} m` : "—"}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{source.live ? `${num(source.meanAbsoluteDiff, 2)} m` : "—"}</td>
                        <td className="px-2 py-1.5 tabular-nums">{source.live ? `${source.bias >= 0 ? "+" : ""}${num(source.bias, 2)} m` : "—"}</td>
                        <td className="px-2.5 py-1.5">
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                              !source.live
                                ? "bg-paper text-muted"
                                : source.agreementPct >= 85
                                  ? "bg-leaf-50 text-leaf-600"
                                  : source.agreementPct >= 65
                                    ? "bg-amber-50 text-amber-800"
                                    : "bg-[#f6e8eb] text-[#8c2f43]",
                            )}
                          >
                            {source.live ? `${num(source.agreementPct, 0)}%` : "offline"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-line px-2.5 py-1.5 text-[8px] leading-snug text-muted">
                Perfis calculados por amostragem direta ponto a ponto no MDE, a cada 5 m, com suavização 1‑2‑1 dupla para
                remover a quantização do modelo de 30 m (mesmo tratamento aplicado pelo Google Earth). Linhas centrais de
                comprimento e largura traçadas na ficha e no mapa (tracejado bordô = comprimento; petróleo = largura).
              </p>
            </div>
          ) : null}

          {grading ? (
            <div className="rounded-xl border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/50 px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <Mountain className="h-3.5 w-3.5 text-[#8c2f43]" />
                  <div>
                    <p className="text-[11px] font-semibold text-ink">Parecer de custo de terraplenagem <FieldHelp helpKey="terreno.cutFill" label="Parecer de terraplenagem" /></p>
                    <p className="text-[8px] text-muted">volumes calculados somente dentro da demarcação do KMZ</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted">
                  cota de projeto <strong className="text-ink-soft">{num(grading.targetElevation, 2)} m</strong> ·{" "}
                  {TARGET_MODES.find((mode) => mode.value === grading.targetMode)?.label ?? grading.targetMode}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 sm:grid-cols-4">
                {[
                  { label: "Corte", value: `${num(grading.cutVolumeM3)} m³`, hint: `prof. média ${num(grading.avgCutM, 2)} m · máx ${num(grading.maxCutM, 2)} m` },
                  { label: "Aterro", value: `${num(grading.fillVolumeM3)} m³`, hint: `prof. média ${num(grading.avgFillM, 2)} m · máx ${num(grading.maxFillM, 2)} m` },
                  {
                    label: grading.netVolumeM3 >= 0 ? "Excedente (bota-fora)" : "Déficit (empréstimo)",
                    value: `${num(Math.abs(grading.netVolumeM3))} m³`,
                    hint: grading.netVolumeM3 >= 0 ? "material sobrante" : "importar de jazida",
                  },
                  { label: "Custo estimado", value: brl(grading.totalCost, { compact: true }), hint: `${brl(grading.costPerM2)}/m² · ${brl(grading.costPerHa)}/ha` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-line bg-paper/40 px-2 py-1.5">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p>
                    <p className="text-[11px] font-semibold tabular-nums text-ink">{item.value}</p>
                    <p className="text-[8px] text-muted">{item.hint}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto border-t border-line">
                <table className="w-full min-w-[440px] text-left text-[10px]">
                  <thead className="bg-paper/60 text-[8px] uppercase tracking-[0.08em] text-muted">
                    <tr>
                      <th className="px-2.5 py-1.5 font-semibold">Serviço</th>
                      <th className="px-2 py-1.5 font-semibold">Quantidade</th>
                      <th className="px-2 py-1.5 font-semibold">Custo unit.</th>
                      <th className="px-2.5 py-1.5 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {grading.costs.map((line) => (
                      <tr key={line.label}>
                        <td className="px-2.5 py-1.5 text-ink-soft">{line.label}</td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {num(line.quantity)} {line.unit}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{brl(line.unitCost)}</td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">{brl(line.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-line bg-paper/40">
                    <tr>
                      <td colSpan={3} className="px-2.5 py-1.5 font-semibold text-ink">
                        Total estimado · prazo ~{grading.days} dias úteis · {num(grading.cuttingCells)} células de corte /{" "}
                        {num(grading.fillingCells)} de aterro
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums text-[#8c2f43]">{brl(grading.totalCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid gap-2 border-t border-line p-2.5 sm:grid-cols-2">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Equipamentos sugeridos</p>
                  <ul className="mt-1 space-y-0.5 text-[10px] text-ink-soft">
                    {grading.machines.map((machine) => (
                      <li key={machine.name}>
                        {machine.qty}× {machine.name} <span className="text-muted">· {machine.note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Premissas do parecer</p>
                  <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-muted">
                    {grading.notes.map((note) => (
                      <li key={note}>• {note}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-lg bg-paper/70 px-3 py-2 text-[10px] leading-relaxed text-muted">
          Nenhuma análise gerada. Defina equidistância, entorno, critério de cota e resolução, então clique em{" "}
          <strong>Processar análise</strong>. O resultado inclui curvas dentro do KMZ e no entorno, mapa de calor, perfil de
          elevação e parecer de corte/aterro com custo — tudo salvo e visível no mapa.
        </p>
      )}
      </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper/60 px-2.5 py-1.5">
          <p className="text-[10px] text-muted">
            {analysis
              ? `${num(analysis.interval, 1)} m · ${num(stats?.contourCount ?? 0)} curvas · cotas ${num(stats?.minElevation ?? 0, 1)}–${num(stats?.maxElevation ?? 0, 1)} m${
                  grading ? ` · custo ${brl(grading.totalCost, { compact: true })}` : ""
                }`
              : "análise não processada"}
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[10px] font-semibold text-[#8c2f43] hover:underline"
          >
            abrir topografia
          </button>
        </div>
      )}
    </div>
  );
}
