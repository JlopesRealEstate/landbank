/** Tipos compartilhados das restrições (evita dependência circular entre componentes). */
export type RestrictionAxisMeta = {
  axis: [number, number][];
  setbackM: number;
  widthM: number;
  lengthM: number;
  voltageKv: number;
  standard: string;
  source: string;
};

export type RestrictionItem = {
  id: number;
  type: string;
  label: string;
  notes: string;
  coordinates: [number, number][];
  /** perda considerada: SOMENTE a área dentro da demarcação do KMZ */
  areaM2: number;
  /** área total desenhada (inclui trechos fora do KMZ) */
  grossAreaM2?: number;
  /** parcela desenhada fora do KMZ — desconsiderada */
  outsideAreaM2?: number;
  lossPct: number;
  geometryType?: string;
  axisMeta?: RestrictionAxisMeta | null;
};

/** Destaque único verde-limão para todas as restrições (melhor visibilidade no satélite). */
export const RESTRICTION_COLOR = "#84cc16";
export const RESTRICTION_COLOR_DARK = "#4d7c0f";

export const RESTRICTION_TYPE_COLORS: Record<string, string> = {
  app: RESTRICTION_COLOR,
  nascente: RESTRICTION_COLOR,
  linhao: RESTRICTION_COLOR,
  duto: RESTRICTION_COLOR,
  faixa_estrada: RESTRICTION_COLOR,
  reserva_legal: RESTRICTION_COLOR,
  alagado: RESTRICTION_COLOR,
  outro: RESTRICTION_COLOR,
};

export const RESTRICTION_TYPE_LABELS: Record<string, string> = {
  app: "APP",
  nascente: "Nascente",
  linhao: "Linhão",
  duto: "Duto",
  faixa_estrada: "Faixa de domínio",
  reserva_legal: "Reserva legal",
  alagado: "Alagado",
  outro: "Restrição",
};

export function restrictionColor(type: string): string {
  return RESTRICTION_TYPE_COLORS[type] ?? RESTRICTION_COLOR;
}

export function restrictionLabel(type: string): string {
  return RESTRICTION_TYPE_LABELS[type] ?? type;
}
