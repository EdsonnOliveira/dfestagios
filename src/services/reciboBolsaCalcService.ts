import {
  diffDaysExcel,
  formatCurrencyBr,
  formatDatePtBr,
} from './rescisaoCalcService';

export type ReciboBolsaTipo = 'mesFechado' | 'proporcional';

export interface ReciboBolsaCalcInput {
  tipo: ReciboBolsaTipo;
  bolsa: string;
  descontos?: string | number;
  mesReferencia?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface ReciboBolsaCalcResult {
  bolsa: number;
  diasTrabalhados: number;
  valorDia: number;
  valorBruto: number;
  descontos: number;
  valorLiquido: number;
  bolsaFmt: string;
  valorDiaFmt: string;
  valorBrutoFmt: string;
  descontosFmt: string;
  valorLiquidoFmt: string;
  periodoReferencia: string;
  dataInicioFmt: string;
  dataFimFmt: string;
}

const MONTHS_PT_CAPITALIZED = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function parseMoneyBr(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value?.trim()) return 0;
  const cleaned = value
    .replace(/^\s*R\$\s*/i, '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseIsoDateLocal(isoDate: string): Date | null {
  const parts = isoDate.trim().split('-');
  if (parts.length !== 3) return null;
  const y = Number.parseInt(parts[0], 10);
  const m = Number.parseInt(parts[1], 10) - 1;
  const d = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const date = new Date(y, m, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

function toIsoDate(y: number, m: number, d: number): string {
  const month = String(m + 1).padStart(2, '0');
  const day = String(d).padStart(2, '0');
  return `${y}-${month}-${day}`;
}

export function getLastDayOfMonthIsoFromDate(isoDate: string): string | null {
  const date = parseIsoDateLocal(isoDate);
  if (!date) return null;
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return toIsoDate(y, m, lastDay);
}

export function formatMesReferenciaLabel(mesReferencia: string): string {
  const parts = mesReferencia.trim().split('-');
  if (parts.length !== 2) return mesReferencia;
  const y = Number.parseInt(parts[0], 10);
  const m = Number.parseInt(parts[1], 10) - 1;
  if (!Number.isFinite(y) || m < 0 || m > 11) return mesReferencia;
  return `${MONTHS_PT_CAPITALIZED[m]}/${y}`;
}

export function countDaysInclusive(startIso: string, endIso: string): number {
  const diff = diffDaysExcel(startIso, endIso);
  if (diff < 0) return 0;
  return diff + 1;
}

export function calculateReciboBolsa(
  input: ReciboBolsaCalcInput
): ReciboBolsaCalcResult | null {
  const bolsa = parseMoneyBr(input.bolsa);
  if (bolsa <= 0) return null;
  const descontos = parseMoneyBr(input.descontos);
  const valorDia = bolsa / 30;

  if (input.tipo === 'mesFechado') {
    const mes = input.mesReferencia?.trim() ?? '';
    if (!mes) return null;
    const valorBruto = bolsa;
    const valorLiquido = valorBruto - descontos;
    return {
      bolsa,
      diasTrabalhados: 30,
      valorDia,
      valorBruto,
      descontos,
      valorLiquido,
      bolsaFmt: formatCurrencyBr(bolsa),
      valorDiaFmt: formatCurrencyBr(valorDia),
      valorBrutoFmt: formatCurrencyBr(valorBruto),
      descontosFmt: formatCurrencyBr(descontos),
      valorLiquidoFmt: formatCurrencyBr(valorLiquido),
      periodoReferencia: formatMesReferenciaLabel(mes),
      dataInicioFmt: '',
      dataFimFmt: '',
    };
  }

  const dataInicio = input.dataInicio?.trim() ?? '';
  const dataFim =
    input.dataFim?.trim() ?? getLastDayOfMonthIsoFromDate(dataInicio) ?? '';
  if (!dataInicio || !dataFim) return null;

  const diasTrabalhados = countDaysInclusive(dataInicio, dataFim);
  if (diasTrabalhados <= 0) return null;

  const valorBruto = diasTrabalhados * valorDia;
  const valorLiquido = valorBruto - descontos;
  const inicioFmt = formatDatePtBr(dataInicio);
  const fimFmt = formatDatePtBr(dataFim);

  return {
    bolsa,
    diasTrabalhados,
    valorDia,
    valorBruto,
    descontos,
    valorLiquido,
    bolsaFmt: formatCurrencyBr(bolsa),
    valorDiaFmt: formatCurrencyBr(valorDia),
    valorBrutoFmt: formatCurrencyBr(valorBruto),
    descontosFmt: formatCurrencyBr(descontos),
    valorLiquidoFmt: formatCurrencyBr(valorLiquido),
    periodoReferencia: `${inicioFmt} á ${fimFmt}`,
    dataInicioFmt: inicioFmt,
    dataFimFmt: fimFmt,
  };
}
