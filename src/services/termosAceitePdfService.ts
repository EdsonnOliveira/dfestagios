import jsPDF from 'jspdf';
import {
  TERMOS_CLAUSULAS,
  TERMOS_TITULO,
  VERSAO_TERMOS,
} from '../constants/termosContratacao';

export type TermosAceitePdfInput = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  nomeSignatario: string;
  cargoSignatario?: string;
  emailSignatario?: string;
  aceitoEm: Date;
  versaoTermos?: string;
};

function formatDateTimeBr(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function generateTermosAceitePdfBlob(input: TermosAceitePdfInput): Blob {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const primaryColor: [number, number, number] = [0, 64, 133];
  let y = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const writeWrapped = (
    text: string,
    options?: { fontSize?: number; fontStyle?: 'normal' | 'bold' }
  ) => {
    const fontSize = options?.fontSize ?? 10;
    const fontStyle = options?.fontStyle ?? 'normal';
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, margin, y);
      y += 5;
    }
  };

  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DF ESTÁGIOS', pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprovante de Aceite — Termos de Contratação', pageWidth / 2, 20, {
    align: 'center',
  });

  y = 38;
  doc.setTextColor(0, 0, 0);
  writeWrapped(TERMOS_TITULO, { fontSize: 11, fontStyle: 'bold' });
  y += 4;

  writeWrapped(`Empresa: ${input.razaoSocial}`, { fontStyle: 'bold' });
  if (input.nomeFantasia?.trim()) {
    writeWrapped(`Nome fantasia: ${input.nomeFantasia}`);
  }
  writeWrapped(`CNPJ: ${input.cnpj}`);
  y += 4;

  for (const clausula of TERMOS_CLAUSULAS) {
    ensureSpace(14);
    writeWrapped(`${clausula.numero}. ${clausula.titulo}`, {
      fontSize: 11,
      fontStyle: 'bold',
    });
    y += 1;
    for (const paragrafo of clausula.paragrafos) {
      writeWrapped(paragrafo, { fontSize: 9 });
      y += 2;
    }
    y += 2;
  }

  ensureSpace(40);
  y += 4;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  writeWrapped('REGISTRO DE ACEITE', { fontSize: 12, fontStyle: 'bold' });
  y += 2;
  writeWrapped(
    'Declaro que li e concordo integralmente com as Regras Gerais e Termos de Contratação da DF Estágios.',
    { fontSize: 9 }
  );
  y += 3;
  writeWrapped(`Signatário: ${input.nomeSignatario}`, { fontStyle: 'bold' });
  if (input.cargoSignatario?.trim()) {
    writeWrapped(`Cargo: ${input.cargoSignatario}`);
  }
  if (input.emailSignatario?.trim()) {
    writeWrapped(`E-mail: ${input.emailSignatario}`);
  }
  writeWrapped(`Data e hora do aceite: ${formatDateTimeBr(input.aceitoEm)}`);
  writeWrapped(`Versão dos termos: ${input.versaoTermos ?? VERSAO_TERMOS}`);

  y = pageHeight - 12;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Documento gerado eletronicamente pela plataforma DF Estágios.',
    pageWidth / 2,
    y,
    { align: 'center' }
  );

  return doc.output('blob');
}

export function downloadBlobAsFile(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
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
