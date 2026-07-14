import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import {
  calculateRescisao,
  formatDatePtBr,
  type RescisaoCalcResult,
} from './rescisaoCalcService';

export interface RescisaoDocxPayload {
  empresaRazaoSocial: string;
  empresaCnpj: string;
  empresaCidade: string;
  estagiarioNome: string;
  estagiarioCpf: string;
  bolsa: string;
  dataInicio: string;
  dataSaida: string;
  dataUltimoPagamento?: string;
  descontos?: string | number;
}

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

function zTrim(s: string | undefined): string {
  if (s === undefined || s === null) return '';
  return String(s).trim();
}

function formatCidadeData(cidade: string, isoDate: string): string {
  const parts = isoDate.trim().split('-');
  const city = zTrim(cidade) || 'Brasília';
  if (parts.length !== 3) {
    return `${city}, ${formatDatePtBr(isoDate)}.`;
  }
  const y = Number.parseInt(parts[0], 10);
  const m = Number.parseInt(parts[1], 10) - 1;
  const d = Number.parseInt(parts[2], 10);
  const monthName = MONTHS_PT[m] ?? '';
  return `${city}, ${d} de ${monthName} de ${y}.`;
}

function buildTemplateData(
  payload: RescisaoDocxPayload,
  calc: RescisaoCalcResult
): Record<string, string> {
  const ultimoFmt = calc.dataUltimoPagamentoFmt || '—';
  return {
    dataRescisao: calc.dataSaidaFmt,
    empresaRazaoSocial: zTrim(payload.empresaRazaoSocial),
    empresaCnpj: zTrim(payload.empresaCnpj),
    estagiarioNome: zTrim(payload.estagiarioNome),
    estagiarioCpf: zTrim(payload.estagiarioCpf),
    dataAdmissao: calc.dataInicioFmt,
    dataDemissao: calc.dataSaidaFmt,
    bolsaAuxilio: calc.bolsaFmt,
    feriasAnuais: calc.bolsaFmt,
    diasBolsa: String(calc.diasTrabalhados),
    dataUltimoPagamento: ultimoFmt,
    saldoBolsa: calc.valorDiasTrabalhadosFmt,
    diasFerias: String(calc.diasFerias),
    saldoFerias: calc.proporcionalFeriasFmt,
    descontos: calc.descontosFmt,
    valorTotal: calc.valorLiquidoFmt,
    cidadeData: formatCidadeData(payload.empresaCidade, payload.dataSaida),
  };
}

export async function generateRescisaoDocxBlob(
  payload: RescisaoDocxPayload
): Promise<Blob> {
  const calc = calculateRescisao({
    bolsa: payload.bolsa,
    dataInicio: payload.dataInicio,
    dataSaida: payload.dataSaida,
    dataUltimoPagamento: payload.dataUltimoPagamento,
    descontos: payload.descontos,
  });
  if (!calc) {
    throw new Error('Não foi possível calcular a rescisão com os dados informados.');
  }

  const res = await fetch('/templates/rescisao.docx');
  if (!res.ok) {
    throw new Error('Failed to load rescisao template');
  }
  const arrayBuffer = await res.arrayBuffer();
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.setData(buildTemplateData(payload, calc));
  doc.render();
  const out = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }) as Blob;
  return out;
}

export function downloadRescisaoDocx(blob: Blob, estagiarioNome: string): void {
  const safe = zTrim(estagiarioNome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  const fileName = `${safe || 'estagiario'}_Rescisao.docx`;
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
}
