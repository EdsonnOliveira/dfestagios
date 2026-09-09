import type { RelatorioAdministrativoEvento } from '../types/firebase';

export function getTodayIsoDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateShortPtBr(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '-';
  if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    if (parts[2].length === 4) {
      return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
    }
    return trimmed;
  }
  const [year, month, day] = trimmed.split('-').map(Number);
  if (!year || !month || !day) return trimmed;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

export function parseDataReferenciaToIso(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (brMatch) {
    const day = brMatch[1];
    const month = brMatch[2];
    const yearRaw = brMatch[3];
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

export function formatDateLongPtBr(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR');
}

function formatReposicaoLabel(haveraReposicao?: boolean | null): string {
  if (haveraReposicao === true) return '(Haverá reposição)';
  if (haveraReposicao === false) return '(Não haverá reposição)';
  return '';
}

export function buildRelatorioAdministrativoDiario(
  isoDate: string,
  eventos: RelatorioAdministrativoEvento[]
): string {
  const contratos = eventos
    .filter((item) => item.tipo === 'contrato')
    .sort((a, b) => a.estagiarioNome.localeCompare(b.estagiarioNome, 'pt-BR'));
  const rescisoes = eventos
    .filter((item) => item.tipo === 'rescisao')
    .sort((a, b) => a.estagiarioNome.localeCompare(b.estagiarioNome, 'pt-BR'));

  const contratoLines =
    contratos.length > 0
      ? contratos.map(
          (item) =>
            `${item.clienteNome.toUpperCase()} - ${item.estagiarioNome.toUpperCase()} - INÍCIO ${formatDateShortPtBr(item.dataReferencia)}`
        )
      : ['Nenhum contrato adicionado neste dia.'];

  const rescisaoLines =
    rescisoes.length > 0
      ? rescisoes.map((item) =>
          `${item.clienteNome.toUpperCase()} - ${item.estagiarioNome.toUpperCase()} - SAÍDA ${formatDateShortPtBr(item.dataReferencia)} ${formatReposicaoLabel(item.haveraReposicao)}`.trim()
        )
      : ['Nenhuma rescisão registrada neste dia.'];

  return [
    `Relatório Administrativo Diário - ${formatDateLongPtBr(isoDate)}`,
    '',
    '*CONTRATOS ADICIONADOS*',
    '',
    ...contratoLines.flatMap((line, index) =>
      index < contratoLines.length - 1 ? [line, ''] : [line]
    ),
    '',
    '---------------------------',
    '',
    '*RESCISÕES*',
    '',
    ...rescisaoLines.flatMap((line, index) =>
      index < rescisaoLines.length - 1 ? [line, ''] : [line]
    ),
  ].join('\n');
}
