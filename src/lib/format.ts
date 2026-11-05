export const KIND_LABELS: Record<string, string> = {
  terreno: "Terreno / gleba",
  galpao: "Galpão / logística",
  misto: "Uso misto",
};

export const STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível",
  em_estudo: "Em estudo",
  em_negociacao: "Em negociação",
  reservado: "Reservado",
  vendido: "Vendido",
  cancelado: "Cancelado",
};

/** Status encerrados: saem do controle operacional e ficam disponíveis apenas em consulta. */
export const ARCHIVED_STATUSES = ["vendido", "cancelado"] as const;
export const ACTIVE_STATUSES = ["disponivel", "em_estudo", "em_negociacao", "reservado"] as const;
export const isArchivedStatus = (status: string) => (ARCHIVED_STATUSES as readonly string[]).includes(status);

/** Apenas áreas, glebas e galpões entram na análise de mercado (residenciais ficam fora). */
export function isMarketEligibleKind(kind: string): boolean {
  return kind === "terreno" || kind === "galpao";
}

export const STATUS_STYLES: Record<string, string> = {
  disponivel: "bg-emerald-50 text-emerald-700 border-emerald-200",
  em_estudo: "bg-sky-50 text-sky-700 border-sky-200",
  em_negociacao: "bg-amber-50 text-amber-800 border-amber-200",
  reservado: "bg-violet-50 text-violet-700 border-violet-200",
  vendido: "bg-[#e8eef0] text-[#154a58] border-[#c3d3d8]",
  cancelado: "bg-[#f6e8eb] text-[#8c2f43] border-[#e3c2c9]",
};

export const TRANSACTION_LABELS: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
};

export const DOCUMENT_CATEGORIES = [
  "Matrícula",
  "Planta",
  "Projeto",
  "Mapa",
  "Laudo",
  "Contrato",
  "KMZ",
  "Outro",
];

export function brl(value: number | null | undefined, options?: { compact?: boolean }): string {
  const amount = Number(value ?? 0);
  if (options?.compact) {
    if (amount >= 1_000_000) {
      return `R$ ${(amount / 1_000_000).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })} mi`;
    }
    if (amount >= 1_000) {
      return `R$ ${(amount / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
    }
  }
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function num(value: number | null | undefined, digits = 0): string {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Alqueire paulista = 24.200 m² (o mais usado no Estado de São Paulo).
 * Observação: alqueire mineiro/goiano = 48.400 m² e alqueire do norte = 27.225 m².
 */
export const ALQUEIRE_PAULISTA_M2 = 24200;

export function alqueireLabel(m2: number | null | undefined, digits = 2): string {
  const value = Number(m2 ?? 0) / ALQUEIRE_PAULISTA_M2;
  return `${num(value, digits)} alq`;
}

/** Ex.: "67,34 ha · 27,83 alq" */
export function areaHaAlq(m2: number | null | undefined): string {
  const value = Number(m2 ?? 0);
  return `${num(value / 10_000, 2)} ha · ${alqueireLabel(value)}`;
}

/** Ex.: "673.435 m² · 67,34 ha · 27,83 alq" — padrão completo para fichas e cards */
export function areaFullLabel(m2: number | null | undefined): string {
  const value = Number(m2 ?? 0);
  return `${num(value)} m² · ${num(value / 10_000, 2)} ha · ${alqueireLabel(value)}`;
}

export function areaLabel(m2: number | null | undefined): string {
  const value = Number(m2 ?? 0);
  if (value >= 10_000) {
    return `${num(value / 10_000, 2)} ha`;
  }
  return `${num(value)} m²`;
}

export function areaWithM2(m2: number | null | undefined): string {
  return `${areaLabel(m2)} · ${num(m2)} m²`;
}

export function dateLabel(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function percent(value: number, digits = 1): string {
  return `${num(value, digits)}%`;
}

export function cleanPhone(value: string): string {
  return (value || "").replace(/\D/g, "");
}

export function slugSafe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}
