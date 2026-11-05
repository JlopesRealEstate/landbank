"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AlertTriangle, Ban, Loader2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { areaLabel, num } from "@/lib/format";
import { cn } from "@/components/ui";
import { RestrictionOverview } from "@/components/areas/restriction-overview";
import { restrictionColor, restrictionLabel, type RestrictionItem } from "@/lib/restriction-types";
import { corridorFromAxis, LINHAO_TEMPLATES, templateById } from "@/lib/linhao";
import { FieldHelp } from "@/components/ui/field-help";

export type { RestrictionItem } from "@/lib/restriction-types";

export const RESTRICTION_TYPES: { value: string; label: string; color: string }[] = [
  { value: "app", label: "APP / mata ciliar", color: "bg-[#2f7d4f]" },
  { value: "nascente", label: "Nascente / olho d'água", color: "bg-[#1c5a6b]" },
  { value: "linhao", label: "Linhão de energia", color: "bg-[#8c2f43]" },
  { value: "duto", label: "Duto / gasoduto", color: "bg-[#a8465c]" },
  { value: "faixa_estrada", label: "Faixa de domínio / estrada", color: "bg-[#b08300]" },
  { value: "reserva_legal", label: "Reserva legal", color: "bg-[#4d7c3f]" },
  { value: "alagado", label: "Área alagada / várzea", color: "bg-[#2c7a8c]" },
  { value: "outro", label: "Outra restrição", color: "bg-[#6b7a80]" },
];

const labelOf = (type: string) => RESTRICTION_TYPES.find((item) => item.value === type)?.label ?? type;

export function RestrictionsPanel({
  areaId,
  totalAreaM2,
  initial,
  geometry = [],
  onChange,
}: {
  areaId: number;
  totalAreaM2: number;
  initial: RestrictionItem[];
  geometry?: [number, number][][];
  onChange?: (items: RestrictionItem[]) => void;
}) {
  const [items, setItems] = useState<RestrictionItem[]>(initial);
  const [type, setType] = useState("app");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [focus, setFocus] = useState<[number, number][] | null>(null);
  const [axis, setAxis] = useState<[number, number][]>([]);
  const [templateId, setTemplateId] = useState("at-69-88-138");
  const [setbackInput, setSetbackInput] = useState("15");


  function openItem(item: RestrictionItem) {
    setEditingId(item.id);
    setType(item.type);
    setLabel(item.label);
    setNotes(item.notes);
    setPolygon(item.coordinates.map(([lng, lat]) => [lng, lat] as [number, number]));
    if (item.geometryType === "axis" && item.axisMeta) {
      setAxis(item.axisMeta.axis);
      setSetbackInput(String(item.axisMeta.setbackM));
    } else {
      setAxis([]);
    }
    setFocus(item.coordinates.map(([lng, lat]) => [lng, lat] as [number, number]));
    setCollapsed(false);
    setMessage({
      tone: "ok",
      text: `Demarcação de ${restrictionLabel(item.type)} carregada no mapa (${areaLabel(item.areaM2)} · ${num(item.lossPct, 2)}%). Ajuste os pontos e salve para atualizar.`,
    });
  }

  const draftArea = useMemo(() => {
    if (polygon.length < 3) return 0;
    const mPerLat = 111320;
    const mPerLng = 111320 * Math.cos((polygon[0][1] * Math.PI) / 180);
    let sum = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const [lngA, latA] = polygon[index];
      const [lngB, latB] = polygon[(index + 1) % polygon.length];
      sum += lngA * mPerLng * (latB * mPerLat) - lngB * mPerLng * (latA * mPerLat);
    }
    return Math.round(Math.abs(sum) / 2);
  }, [polygon]);

  const isAxis = type === "linhao";
  const template = templateById(templateId);
  const setbackM = Math.max(1, Number(setbackInput) || template.setbackM);

  const corridor = useMemo(
    () => (isAxis && axis.length >= 2 ? corridorFromAxis(axis, setbackM) : null),
    [isAxis, axis, setbackM],
  );

  const activePolygon = isAxis ? (corridor?.polygon ?? []) : polygon;
  const activeArea = isAxis ? (corridor?.areaM2 ?? 0) : draftArea;

  const totalRestricted = items.reduce((sum, item) => sum + item.areaM2, 0);
  const totalLossPct = totalAreaM2 > 0 ? (totalRestricted / totalAreaM2) * 100 : 0;
  const netArea = Math.max(0, totalAreaM2 - totalRestricted);

  function update(next: RestrictionItem[]) {
    setItems(next);
    onChange?.(next);
  }

  async function save() {
    if (isAxis) {
      if (axis.length < 2) {
        setMessage({ tone: "error", text: "Trace ao menos 2 pontos do eixo do linhão no mapa." });
        return;
      }
    } else if (polygon.length < 3) {
      setMessage({ tone: "error", text: "Clique no mapa (aba Mapa) para demarcar ao menos 3 pontos." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/areas/${areaId}/restrictions`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isAxis
            ? { id: editingId ?? undefined, type, label, notes, axis, setbackM, templateId }
            : { id: editingId ?? undefined, type, label, notes, coordinates: polygon },
        ),
      });
      const data = (await response.json()) as { ok: boolean; restriction?: RestrictionItem; error?: string };
      if (!response.ok || !data.ok || !data.restriction) throw new Error(data.error ?? "Falha ao salvar.");
      update([...items.filter((item) => item.id !== data.restriction!.id), data.restriction]);
      // mantém a demarcação visível no mapa (não limpa o desenho)
      setPolygon(data.restriction.coordinates.map(([lng, lat]) => [lng, lat] as [number, number]));
      if (data.restriction.geometryType === "axis" && data.restriction.axisMeta) {
        setAxis(data.restriction.axisMeta.axis);
        setSetbackInput(String(data.restriction.axisMeta.setbackM));
      } else if (!isAxis) {
        setAxis([]);
      }
      setEditingId(null);
      setLabel("");
      setNotes("");
      setMessage({
        tone: "ok",
        text: data.restriction.geometryType === "axis"
          ? `Faixa de servidão salva pelo eixo (${data.restriction.axisMeta?.setbackM} m por lado · ${
              data.restriction.axisMeta?.widthM
            } m total): ${areaLabel(data.restriction.areaM2)} de perda (${num(data.restriction.lossPct, 2)}%).`
          : `Restrição salva e mantida no mapa: ${areaLabel(data.restriction.areaM2)} de perda (${num(data.restriction.lossPct, 2)}%).`,
      });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Falha ao salvar." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: RestrictionItem) {
    const confirmed = window.confirm(
      `Excluir a demarcação de ${restrictionLabel(item.type)}${
        item.label ? ` (${item.label})` : ""
      }?\n\nPerda considerada: ${areaLabel(item.areaM2)} · ${num(item.lossPct, 2)}% do KMZ.\nEsta ação remove o polígono do mapa e não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/areas/${areaId}/restrictions?restrictionId=${item.id}`, { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Falha ao excluir.");
      update(items.filter((current) => current.id !== item.id));
      if (editingId === item.id) {
        setEditingId(null);
        setPolygon([]);
        setAxis([]);
        setLabel("");
        setNotes("");
        setMessage({ tone: "ok", text: `Demarcação de ${restrictionLabel(item.type)} excluída do mapa.` });
      } else {
        setMessage({ tone: "ok", text: `Demarcação de ${restrictionLabel(item.type)} excluída.` });
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Falha ao excluir a demarcação." });
    } finally {
      setBusy(false);
    }
  }

  /** Sai do modo correção sem alterar a demarcação salva. */
  function cancelEdit() {
    setEditingId(null);
    setPolygon([]);
    setAxis([]);
    setLabel("");
    setNotes("");
    setMessage({ tone: "ok", text: "Edição cancelada. A demarcação original foi mantida." });
  }

  /** Move um vértice (arrastar no mapa) — correção precisa da demarcação. */
  function moveVertex(index: number, point: [number, number], kind: "polygon" | "axis") {
    if (kind === "axis") {
      setAxis((current) => current.map((item, position) => (position === index ? point : item)));
    } else {
      setPolygon((current) => current.map((item, position) => (position === index ? point : item)));
    }
    setMessage({ tone: "ok", text: "Vértice ajustado. Clique em “Salvar correção” para gravar a alteração." });
  }

  /** Remove um vértice específico clicando nele no mapa. */
  function removeVertex(index: number, kind: "polygon" | "axis") {
    if (kind === "axis") setAxis((current) => current.filter((_, position) => position !== index));
    else setPolygon((current) => current.filter((_, position) => position !== index));
    setMessage({ tone: "ok", text: "Vértice removido. Salve a correção para atualizar a demarcação." });
  }

  /** Remove o último ponto marcado (correção rápida da demarcação). */
  function undoPoint() {
    if (type === "linhao") setAxis((current) => current.slice(0, -1));
    else setPolygon((current) => current.slice(0, -1));
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f6e8eb] text-[#8c2f43]">
            <Ban className="h-4 w-4" />
          </span>
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold text-ink">
            Restrições e perda de área <FieldHelp helpKey="restricoes.lossPct" label="Perda de área" />
          </p>
            <p className="text-[10px] text-muted">
              APP, nascente, linhão, duto, faixa de domínio… Demarque no mapa para calcular a perda sobre o total.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-[#e3c2c9] bg-[#f6e8eb]/50 px-2.5 py-1.5 text-right">
            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#8c2f43]">Perda total</p>
            <p className="text-sm font-semibold tabular-nums text-[#8c2f43]">{num(totalLossPct, 2)}%</p>
            <p className="text-[8px] text-muted">
              {areaLabel(totalRestricted)} de {areaLabel(totalAreaM2)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[10px] font-medium text-ink hover:border-[#8c2f43] hover:text-[#8c2f43]"
          >
            {collapsed ? "Expandir" : "Recolher"}
          </button>
        </div>
      </div>

      {editingId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#8c2f43]/40 bg-[#f6e8eb]/70 px-2.5 py-1.5">
          <p className="text-[10px] font-semibold text-[#8c2f43]">
            <Pencil className="mr-1 inline h-3 w-3" />
            Corrigindo demarcação existente — {restrictionLabel(type)}
            {label ? ` (${label})` : ""}. Ajuste os pontos no mapa e clique em “Salvar correção”.
          </p>
          <button
            type="button"
            onClick={cancelEdit}
            className="rounded-md border border-[#8c2f43]/40 bg-white px-2 py-0.5 text-[9.5px] font-medium text-[#8c2f43] hover:border-[#8c2f43]"
          >
            Cancelar edição
          </button>
        </div>
      ) : null}

      {collapsed ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper/60 px-2.5 py-1.5">
          <p className="text-[10px] text-muted">
            {items.length} restrição(ões) · perda dentro do KMZ {num(totalLossPct, 2)}% ({areaLabel(totalRestricted)}) ·
            aproveitável {areaLabel(netArea)}
          </p>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="text-[10px] font-semibold text-[#8c2f43] hover:underline"
          >
            + demarcar nova restrição
          </button>
        </div>
      ) : null}

      {!collapsed ? (
      <div className="space-y-2.5">

      <div className="grid gap-2 rounded-xl border border-line bg-paper/50 p-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            Tipo <FieldHelp helpKey="restricoes.type" label="Tipo de restrição" />
          </span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px]"
          >
            {RESTRICTION_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
            Identificação <FieldHelp helpKey="restricoes.label" label="Identificação da restrição" />
          </span>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Ex.: APP do córrego / Linhão CPFL"
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px]"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">Observações</span>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Faixa de 30 m ao longo do curso d'água, servidão, etc."
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px]"
          />
        </label>
      </div>

      {isAxis ? (
        <div className="grid gap-2 rounded-xl border border-[#e3c2c9] bg-[#f6e8eb]/30 p-2.5 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8c2f43]">
              Padrão de faixa de servidão (recuo a partir do eixo)
              <FieldHelp helpKey="restricoes.axisTool" label="Traço de linhão" />
            </span>
            <select
              value={templateId}
              onChange={(event) => {
                const next = templateById(event.target.value);
                setTemplateId(event.target.value);
                setSetbackInput(String(next.setbackM));
              }}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px]"
            >
              {LINHAO_TEMPLATES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} — {option.setbackM} m por lado ({option.setbackM * 2} m total)
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[8px] text-muted">
              {template.note} · fonte: {template.source}
            </span>
          </label>
          <label className="block">
            <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted">
              Recuo do eixo (m/lado) <FieldHelp helpKey="restricoes.setback" label="Recuo do eixo" />
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={setbackInput}
              onChange={(event) => setSetbackInput(event.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-[11px] tabular-nums"
            />
            <span className="mt-0.5 block text-[8px] text-muted">faixa total {setbackM * 2} m</span>
          </label>
          <div className="sm:col-span-3 rounded-lg border border-dashed border-[#8c2f43]/40 bg-white px-2 py-1.5">
            <p className="text-[10px] font-medium text-ink">
              Ferramenta ativa: <strong className="text-[#8c2f43]">traço (eixo do linhão)</strong> — clique no mapa para
              traçar o eixo; a faixa é calculada automaticamente a partir do eixo.
            </p>
            <p className="text-[9px] text-muted">
              {axis.length} ponto(s) no eixo
              {corridor
                ? ` · comprimento ${num(corridor.lengthM, 1)} m · faixa ${setbackM * 2} m · área ${areaLabel(corridor.areaM2)} (${num(
                    totalAreaM2 > 0 ? (corridor.areaM2 / totalAreaM2) * 100 : 0,
                    2,
                  )}% de perda)`
                : " · trace ao menos 2 pontos"}
            </p>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-paper/60 px-2.5 py-1.5 text-[10px] text-muted">
          Ferramenta ativa: <strong className="text-ink-soft">demarcação por vértices (polígono)</strong> <FieldHelp helpKey="restricoes.polygonTool" label="Demarcação por polígono" /> — clique no mapa
          para marcar a área da restrição (mínimo 3 pontos).
        </p>
      )}

      <RestrictionOverview
        geometry={geometry}
        restrictions={items}
        totalAreaM2={totalAreaM2}
        draft={polygon}
        draftAreaM2={draftArea}
        onFocus={(item) => {
          setEditingId(item.id);
          setFocus(item.coordinates);
          setCollapsed(false);
        }}
        onEdit={(item) => openItem(item)}
        onDelete={(item) => void remove(item)}
      />

      <PolygonPicker
        polygon={polygon}
        setPolygon={setPolygon}
        draftArea={draftArea}
        totalAreaM2={totalAreaM2}
        geometry={geometry}
        restrictions={items}
        activeId={editingId}
        focus={focus}
        isAxis={isAxis}
        axis={axis}
        axisCorridor={corridor?.polygon ?? null}
        onAddAxisPoint={(point) => {
          if (isAxis) setAxis([...axis, point]);
          else setPolygon([...polygon, point]);
        }}
        onMoveVertex={moveVertex}
        onRemoveVertex={removeVertex}
      />

      <p className="rounded-lg bg-leaf-50/60 px-2.5 py-1.5 text-[9.5px] leading-snug text-leaf-600">
        A perda considera <strong>apenas a área dentro da demarcação do KMZ</strong>. Trechos desenhados fora do perímetro
        são ignorados no cálculo de m² e de percentual.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || (isAxis ? axis.length < 2 : polygon.length < 3)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8c2f43] px-3 py-2 text-[10px] font-semibold text-white hover:bg-[#7a2739] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          {editingId
            ? "Salvar correção"
            : isAxis
              ? "Salvar faixa de servidão"
              : "Salvar restrição demarcada"}
        </button>
        <button
          type="button"
          onClick={undoPoint}
          disabled={isAxis ? axis.length === 0 : polygon.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[10px] font-medium text-ink hover:border-[#8c2f43] disabled:opacity-40"
          title="Remover o último ponto marcado"
        >
          Desfazer ponto
        </button>
        <button
          type="button"
          onClick={() => (isAxis ? setAxis([]) : setPolygon([]))}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[10px] font-medium text-ink hover:border-[#8c2f43]"
        >
          <X className="h-3 w-3" /> Limpar {isAxis ? "eixo" : "demarcação"}
        </button>
        <span className="text-[9px] text-muted">
          {isAxis
            ? `${axis.length} ponto(s) no eixo · ${areaLabel(activeArea)}${
                activeArea > 0 && totalAreaM2 > 0 ? ` · ${num((activeArea / totalAreaM2) * 100, 2)}% do imóvel` : ""
              }`
            : `${polygon.length} ponto(s) marcado(s) · ${areaLabel(draftArea)}${
                draftArea > 0 && totalAreaM2 > 0 ? ` · ${num((draftArea / totalAreaM2) * 100, 2)}% do imóvel` : ""
              }`}
        </span>
      </div>

      {message ? (
        <p
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-[10px]",
            message.tone === "ok" ? "bg-leaf-50 text-leaf-600" : "bg-[#f6e8eb] text-[#8c2f43]",
          )}
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { label: "Área total do imóvel", value: areaLabel(totalAreaM2) },
          { label: "Perda dentro do KMZ", value: areaLabel(totalRestricted) },
          { label: "Área aproveitável", value: `${areaLabel(netArea)} (${num(100 - totalLossPct, 2)}%)` },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-line bg-white px-2 py-1.5">
            <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">{item.label}</p>
            <p className="text-[11px] font-semibold tabular-nums text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      {items.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 px-2.5 py-1.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                style={{ background: restrictionColor(item.type) }}
              >
                <MapPin className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-ink">
                  {labelOf(item.type)}
                  {item.label ? ` · ${item.label}` : ""}
                </p>
                <p className="truncate text-[9px] text-muted">
                  {areaLabel(item.areaM2)} · {num(item.lossPct, 2)}% do imóvel
                  {item.geometryType === "axis" && item.axisMeta
                    ? ` · eixo ${num(item.axisMeta.lengthM, 0)} m · faixa ${item.axisMeta.widthM} m`
                    : (item.outsideAreaM2 ?? 0) > 0
                      ? ` · ${areaLabel(item.outsideAreaM2 ?? 0)} fora do KMZ desconsiderados`
                      : item.notes
                        ? ` · ${item.notes}`
                        : ""}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#f6e8eb] px-1.5 py-0.5 text-[9px] font-semibold text-[#8c2f43]">
                −{num(item.lossPct, 2)}%
              </span>
              <button
                type="button"
                onClick={() => openItem(item)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[9px] font-semibold",
                  editingId === item.id
                    ? "border-[#8c2f43] bg-[#f6e8eb] text-[#8c2f43]"
                    : "border-line bg-white text-ink-soft hover:border-[#8c2f43] hover:text-[#8c2f43]",
                )}
                aria-label={`Corrigir demarcação de ${restrictionLabel(item.type)}`}
                title="Corrigir demarcação no mapa"
              >
                <Pencil className="h-3 w-3" /> Corrigir
              </button>
              <button
                type="button"
                onClick={() => void remove(item)}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-1.5 py-1 text-[9px] font-semibold text-ink-soft hover:border-[#b91c1c] hover:text-[#b91c1c] disabled:opacity-50"
                aria-label={`Excluir demarcação de ${restrictionLabel(item.type)}`}
                title="Excluir demarcação"
              >
                <Trash2 className="h-3 w-3" /> Excluir
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-paper/70 px-2.5 py-1.5 text-[10px] text-muted">
          <AlertTriangle className="mr-1 inline h-3 w-3" /> Nenhuma restrição demarcada. Use o mapa abaixo para marcar
          APP, nascente, linhão e demais faixas não aproveitáveis.
        </p>
      )}
      </div>
      ) : null}
    </div>
  );
}

function PolygonPicker({
  polygon,
  setPolygon,
  draftArea,
  totalAreaM2,
  geometry,
  restrictions,
  activeId,
  focus,
  isAxis,
  axis,
  axisCorridor,
  onAddAxisPoint,
  onMoveVertex,
  onRemoveVertex,
}: {
  polygon: [number, number][];
  setPolygon: (value: [number, number][]) => void;
  draftArea: number;
  totalAreaM2: number;
  geometry: [number, number][][];
  restrictions: RestrictionItem[];
  activeId: number | null;
  focus?: [number, number][] | null;
  isAxis: boolean;
  axis: [number, number][];
  axisCorridor: [number, number][] | null;
  onAddAxisPoint: (point: [number, number]) => void;
  onMoveVertex: (index: number, point: [number, number], kind: "polygon" | "axis") => void;
  onRemoveVertex: (index: number, kind: "polygon" | "axis") => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-2.5 py-1.5">
        <p className="text-[10px] text-muted">
          {isAxis
            ? "Clique no mapa para traçar o EIXO do linhão (mínimo 2 pontos). A faixa de servidão é gerada a partir do eixo."
            : "Clique no mapa para demarcar a restrição (mínimo 3 pontos). A área é calculada automaticamente."}
        </p>
        <p className="text-[9px] font-semibold tabular-nums text-[#8c2f43]">
          {areaLabel(draftArea)}
          {totalAreaM2 > 0 && draftArea > 0 ? ` · ${num((draftArea / totalAreaM2) * 100, 2)}%` : ""}
        </p>
      </div>
      <RestrictionMap
        polygon={polygon}
        setPolygon={setPolygon}
        geometry={geometry}
        restrictions={restrictions.map((item) => ({
          id: item.id,
          type: item.type,
          label: item.label,
          coordinates: item.coordinates,
          areaM2: item.areaM2,
          lossPct: item.lossPct,
        }))}
        activeId={activeId}
        draftArea={draftArea}
        totalAreaM2={totalAreaM2}
        focus={focus}
        isAxis={isAxis}
        axis={axis}
        axisCorridor={axisCorridor}
        onAddAxisPoint={(point: [number, number]) => onAddAxisPoint(point)}
        onMoveVertex={onMoveVertex}
        onRemoveVertex={onRemoveVertex}
      />
    </div>
  );
}

const RestrictionMap = dynamic(() => import("@/components/map/restriction-map").then((mod) => mod.RestrictionMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center bg-[#e7ebe2] text-[10px] text-muted">
      Carregando mapa…
    </div>
  ),
});
