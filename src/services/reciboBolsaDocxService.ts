import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import {
  calculateReciboBolsa,
  type ReciboBolsaCalcInput,
  type ReciboBolsaCalcResult,
  type ReciboBolsaTipo,
} from './reciboBolsaCalcService';

export interface ReciboBolsaDocxPayload extends ReciboBolsaCalcInput {
  empresaRazaoSocial: string;
  empresaCnpj: string;
  estagiarioNome: string;
  estagiarioCpf: string;
}

function zTrim(s: string | undefined): string {
  if (s === undefined || s === null) return '';
  return String(s).trim();
}

function templatePathForTipo(tipo: ReciboBolsaTipo): string {
  if (tipo === 'mesFechado') {
    return '/templates/recibo-bolsa-mes-fechado.docx';
  }
  return '/templates/recibo-bolsa-proporcional.docx';
}

function buildTemplateData(
  payload: ReciboBolsaDocxPayload,
  calc: ReciboBolsaCalcResult
): Record<string, string> {
  return {
    empresaRazaoSocial: zTrim(payload.empresaRazaoSocial),
    empresaCnpj: zTrim(payload.empresaCnpj),
    estagiarioNome: zTrim(payload.estagiarioNome),
    estagiarioCpf: zTrim(payload.estagiarioCpf),
    bolsaAuxilio: calc.bolsaFmt,
    periodoReferencia: calc.periodoReferencia,
    descontos: calc.descontosFmt,
    valorTotal: calc.valorLiquidoFmt,
  };
}

export async function generateReciboBolsaDocxBlob(
  payload: ReciboBolsaDocxPayload
): Promise<Blob> {
  const calc = calculateReciboBolsa(payload);
  if (!calc) {
    throw new Error(
      'Não foi possível calcular o recibo de bolsa com os dados informados.'
    );
  }

  const res = await fetch(templatePathForTipo(payload.tipo));
  if (!res.ok) {
    throw new Error('Failed to load recibo bolsa template');
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

export function downloadReciboBolsaDocx(
  blob: Blob,
  estagiarioNome: string,
  tipo: ReciboBolsaTipo
): void {
  const tipoLabel = tipo === 'mesFechado' ? 'Mes_Fechado' : 'Proporcional';
  const safe = zTrim(estagiarioNome)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  const fileName = `${safe || 'estagiario'}_Recibo_Bolsa_${tipoLabel}.docx`;
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
