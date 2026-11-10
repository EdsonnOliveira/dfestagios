import jsPDF from 'jspdf';
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

export function groupEventosByDataRegistro(
  eventos: RelatorioAdministrativoEvento[]
): Array<{ dataRegistro: string; eventos: RelatorioAdministrativoEvento[] }> {
  const byDate = new Map<string, RelatorioAdministrativoEvento[]>();
  for (const evento of eventos) {
    const key = evento.dataRegistro?.trim();
    if (!key) continue;
    const list = byDate.get(key) ?? [];
    list.push(evento);
    byDate.set(key, list);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dataRegistro, items]) => ({
      dataRegistro,
      eventos: items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    }));
}

function buildContratoLine(item: RelatorioAdministrativoEvento): string {
  return `${item.clienteNome.toUpperCase()} - ${item.estagiarioNome.toUpperCase()} - INÍCIO ${formatDateShortPtBr(item.dataReferencia)}`;
}

function buildRescisaoLine(item: RelatorioAdministrativoEvento): string {
  return `${item.clienteNome.toUpperCase()} - ${item.estagiarioNome.toUpperCase()} - SAÍDA ${formatDateShortPtBr(item.dataReferencia)} ${formatReposicaoLabel(item.haveraReposicao)}`.trim();
}

export function buildRelatorioAdministrativoPeriodo(
  dataInicio: string,
  dataFim: string,
  eventos: RelatorioAdministrativoEvento[]
): string {
  const groups = groupEventosByDataRegistro(eventos);
  if (groups.length === 0) {
    return [
      `Relatório Administrativo - ${formatDateLongPtBr(dataInicio)} a ${formatDateLongPtBr(dataFim)}`,
      '',
      'Nenhum registro no período selecionado.',
    ].join('\n');
  }

  const blocks = groups.map(({ dataRegistro, eventos: dayEventos }) => {
    const contratos = dayEventos
      .filter((item) => item.tipo === 'contrato')
      .sort((a, b) => a.estagiarioNome.localeCompare(b.estagiarioNome, 'pt-BR'));
    const rescisoes = dayEventos
      .filter((item) => item.tipo === 'rescisao')
      .sort((a, b) => a.estagiarioNome.localeCompare(b.estagiarioNome, 'pt-BR'));

    const lines = [`*${formatDateLongPtBr(dataRegistro)}*`];
    if (contratos.length > 0) {
      lines.push('CONTRATOS:');
      lines.push(...contratos.map(buildContratoLine));
    }
    if (rescisoes.length > 0) {
      lines.push('RESCISÕES:');
      lines.push(...rescisoes.map(buildRescisaoLine));
    }
    if (contratos.length === 0 && rescisoes.length === 0) {
      lines.push('Sem registros.');
    }
    return lines.join('\n');
  });

  return [
    `Relatório Administrativo - ${formatDateLongPtBr(dataInicio)} a ${formatDateLongPtBr(dataFim)}`,
    '',
    ...blocks,
  ].join('\n\n');
}

export function exportRelatorioAdministrativoPeriodoPdf(
  dataInicio: string,
  dataFim: string,
  eventos: RelatorioAdministrativoEvento[]
): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 3.6;
  const primaryColor: [number, number, number] = [0, 64, 133];
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 10) {
      doc.addPage();
      y = 10;
    }
  };

  const writeLine = (
    text: string,
    options?: { fontSize?: number; fontStyle?: 'normal' | 'bold'; color?: [number, number, number] }
  ) => {
    const fontSize = options?.fontSize ?? 8;
    const fontStyle = options?.fontStyle ?? 'normal';
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    if (options?.color) {
      doc.setTextColor(options.color[0], options.color[1], options.color[2]);
    } else {
      doc.setTextColor(0, 0, 0);
    }
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RELATÓRIO ADMINISTRATIVO', pageWidth / 2, 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `${formatDateLongPtBr(dataInicio)} a ${formatDateLongPtBr(dataFim)}`,
    pageWidth / 2,
    12.5,
    { align: 'center' }
  );

  y = 20;
  const groups = groupEventosByDataRegistro(eventos);
  if (groups.length === 0) {
    writeLine('Nenhum registro no período selecionado.');
  } else {
    for (const { dataRegistro, eventos: dayEventos } of groups) {
      const contratos = dayEventos
        .filter((item) => item.tipo === 'contrato')
        .sort((a, b) => a.estagiarioNome.localeCompare(b.estagiarioNome, 'pt-BR'));
      const rescisoes = dayEventos
        .filter((item) => item.tipo === 'rescisao')
        .sort((a, b) => a.estagiarioNome.localeCompare(b.estagiarioNome, 'pt-BR'));

      ensureSpace(lineHeight * 2);
      writeLine(formatDateLongPtBr(dataRegistro), {
        fontSize: 9,
        fontStyle: 'bold',
        color: primaryColor,
      });

      if (contratos.length > 0) {
        writeLine(`CONTRATOS (${contratos.length})`, {
          fontSize: 8,
          fontStyle: 'bold',
          color: [22, 101, 52],
        });
        for (const item of contratos) {
          writeLine(buildContratoLine(item));
        }
      }

      if (rescisoes.length > 0) {
        writeLine(`RESCISÕES (${rescisoes.length})`, {
          fontSize: 8,
          fontStyle: 'bold',
          color: [153, 27, 27],
        });
        for (const item of rescisoes) {
          writeLine(buildRescisaoLine(item));
        }
      }

      y += 1.5;
    }
  }

  const now = new Date();
  const stamp = `${now.toLocaleDateString('pt-BR').replace(/\//g, '-')}_${now
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    .replace(/:/g, '-')}`;
  doc.save(
    `Relatorio_Administrativo_${formatDateLongPtBr(dataInicio).replace(/\//g, '-')}_a_${formatDateLongPtBr(dataFim).replace(/\//g, '-')}_${stamp}.pdf`
  );
}
