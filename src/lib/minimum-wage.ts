/**
 * SALÁRIO MÍNIMO DE REFERÊNCIA — ESTADO DE SÃO PAULO
 * ------------------------------------------------------------------
 * O CEMPRE/IBGE publica o "Salário médio mensal dos trabalhadores formais" em
 * SALÁRIOS MÍNIMOS (variável 1606). Para converter em reais usamos o piso
 * regional paulista vigente — Lei estadual nº 18.471/2026: R$ 1.874,36
 * (vigência 01/06/2026). O mínimo nacional de 2026 é R$ 1.621,00.
 *
 * Mantenha este arquivo atualizado quando o piso for reajustado; todo o CRM
 * (dossiê, ficha, inteligência, indicadores) lê daqui.
 */

export type MinimumWage = {
  /** valor mensal em reais */
  value: number;
  /** ano de vigência */
  year: number;
  /** norma que fixou o valor */
  law: string;
  /** data de início da vigência */
  since: string;
  scope: "SP" | "BR";
  label: string;
};

export const MINIMUM_WAGE: MinimumWage = {
  value: 1874.36,
  year: 2026,
  law: "Lei estadual nº 18.471/2026",
  since: "2026-06-01",
  scope: "SP",
  label: "Piso regional São Paulo",
};

export const NATIONAL_MINIMUM_WAGE: MinimumWage = {
  value: 1621,
  year: 2026,
  law: "Decreto nº 12.797/2025",
  since: "2026-01-01",
  scope: "BR",
  label: "Salário mínimo nacional",
};

/** Converte salários mínimos em reais usando o piso paulista vigente. */
export function wagesToBrl(minimumWages: number, wage: MinimumWage = MINIMUM_WAGE): number {
  return Math.round(minimumWages * wage.value * 100) / 100;
}

/** Quantidade de salários mínimos a partir de um valor em reais. */
export function brlToWages(brl: number, wage: MinimumWage = MINIMUM_WAGE): number {
  return wage.value > 0 ? Math.round((brl / wage.value) * 100) / 100 : 0;
}

export const MINIMUM_WAGE_SOURCE =
  "IBGE — Cadastro Central de Empresas 2023 (Salário médio mensal dos trabalhadores formais, em salários mínimos) × piso regional paulista vigente (Lei 18.471/2026, R$ 1.874,36).";
