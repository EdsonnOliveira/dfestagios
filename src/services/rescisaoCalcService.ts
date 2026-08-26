export interface RescisaoCalcInput {
  bolsa: string;
  dataInicio: string;
  dataSaida: string;
  dataUltimoPagamento?: string;
  descontos?: string | number;
}

export interface RescisaoCalcResult {
  bolsa: number;
  diasTrabalhados: number;
  valorDia: number;
  valorDiasTrabalhados: number;
  diasFerias: number;
  valorDiaFerias: number;
  proporcionalFerias: number;
  totalBruto: number;
  descontos: number;
  valorLiquido: number;
  bolsaFmt: string;
  valorDiaFmt: string;
  valorDiasTrabalhadosFmt: string;
  valorDiaFeriasFmt: string;
  proporcionalFeriasFmt: string;
  totalBrutoFmt: string;
  descontosFmt: string;
  valorLiquidoFmt: string;
  dataInicioFmt: string;
  dataSaidaFmt: string;
  dataUltimoPagamentoFmt: string;
}

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

export function formatDatePtBr(isoDate: string): string {
  if (!isoDate?.trim()) return '';
  const date = parseIsoDateLocal(isoDate);
  if (!date) return isoDate;
  return date.toLocaleDateString('pt-BR');
}

export function diffDaysExcel(startIso: string, endIso: string): number {
  const start = parseIsoDateLocal(startIso);
  const end = parseIsoDateLocal(endIso);
  if (!start || !end) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

export function formatCurrencyBr(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatBolsaDisplay(value: string | undefined): string {
  if (!value?.trim()) return '-';
  const trimmed = value.trim();
  const withoutCurrency = trimmed.replace(/^R\$\s?/i, '');
  if (/[a-zA-Z+]/.test(withoutCurrency)) {
    return trimmed;
  }
  const amount = parseMoneyBr(trimmed);
  if (amount > 0) {
    return formatCurrencyBr(amount);
  }
  return trimmed;
}

export function formatBolsaInputFromDigits(digits: string): string {
  if (!digits) return '';
  const numberValue = parseInt(digits, 10) / 100;
  return formatCurrencyBr(numberValue);
}

export function calculateRescisao(
  input: RescisaoCalcInput
): RescisaoCalcResult | null {
  const dataInicio = input.dataInicio?.trim() ?? '';
  const dataSaida = input.dataSaida?.trim() ?? '';
  if (!dataInicio || !dataSaida) return null;

  const bolsa = parseMoneyBr(input.bolsa);
  if (bolsa <= 0) return null;

  const diasFerias = diffDaysExcel(dataInicio, dataSaida);
  if (diasFerias < 0) return null;

  const ultimo = input.dataUltimoPagamento?.trim() ?? '';
  const diasTrabalhadosRaw = ultimo
    ? diffDaysExcel(ultimo, dataSaida)
    : diasFerias;
  if (diasTrabalhadosRaw < 0) return null;
  const diasTrabalhados = diasTrabalhadosRaw;
  const valorDia = bolsa / 30;
  const valorDiasTrabalhados = diasTrabalhados * valorDia;
  const valorDiaFerias = bolsa / 365;
  const proporcionalFerias = diasFerias * valorDiaFerias;
  const totalBruto = valorDiasTrabalhados + proporcionalFerias;
  const descontos = parseMoneyBr(input.descontos);
  const valorLiquido = totalBruto - descontos;

  return {
    bolsa,
    diasTrabalhados,
    valorDia,
    valorDiasTrabalhados,
    diasFerias,
    valorDiaFerias,
    proporcionalFerias,
    totalBruto,
    descontos,
    valorLiquido,
    bolsaFmt: formatCurrencyBr(bolsa),
    valorDiaFmt: formatCurrencyBr(valorDia),
    valorDiasTrabalhadosFmt: formatCurrencyBr(valorDiasTrabalhados),
    valorDiaFeriasFmt: formatCurrencyBr(valorDiaFerias),
    proporcionalFeriasFmt: formatCurrencyBr(proporcionalFerias),
    totalBrutoFmt: formatCurrencyBr(totalBruto),
    descontosFmt: formatCurrencyBr(descontos),
    valorLiquidoFmt: formatCurrencyBr(valorLiquido),
    dataInicioFmt: formatDatePtBr(dataInicio),
    dataSaidaFmt: formatDatePtBr(dataSaida),
    dataUltimoPagamentoFmt: ultimo ? formatDatePtBr(ultimo) : '',
  };
}
