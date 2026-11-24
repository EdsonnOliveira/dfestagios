import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Cliente, Estagiario } from '../types/firebase';
import type { StudentInternship } from '../lib/studentPortal';
import { formatIsoDate } from '../lib/studentPortal';

export async function generateInternshipCertificate(
  student: Estagiario,
  internship: StudentInternship,
  client: Cliente
): Promise<Blob> {
  if (!internship.certificateEligible) throw new Error('O certificado estará disponível após seis meses de estágio.');
  const response = await fetch('/templates/certificado-estagio.pdf');
  if (!response.ok) throw new Error('Modelo do certificado indisponível.');
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  const form = pdf.getForm();
  for (const field of form.getFields()) form.removeField(field);
  const page = pdf.getPage(0);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fields: Record<string, string> = {
    nome_estagiario: student.nome,
    cpf: student.cpf ?? '',
    data_nascimento: formatIsoDate(student.dataNascimento),
    data_inicio: formatIsoDate(internship.startDate),
    data_saida: internship.endDate ? formatIsoDate(internship.endDate) : 'Em andamento',
    total_dias: String(internship.durationDays),
    carga_horaria: '',
    empresa: client.razaoSocial || client.nomeFantasia,
    cnpj: client.cnpj,
    supervisor: student.respLegalNome || client.responsavel || '',
    data_emissao: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
  };
  const positions: Record<string, [number, number, number, number]> = {
    nome_estagiario: [68, 296, 441, 17],
    cpf: [531, 296, 110, 17],
    data_nascimento: [663, 296, 111, 17],
    data_inicio: [68, 253, 145, 17],
    data_saida: [235, 253, 145, 17],
    total_dias: [402, 253, 145, 17],
    carga_horaria: [569, 253, 205, 17],
    empresa: [68, 193, 441, 17],
    cnpj: [531, 193, 243, 17],
    supervisor: [68, 150, 706, 17],
    data_emissao: [119, 75, 115, 12],
  };
  for (const [name, value] of Object.entries(fields)) {
    const [x, y, width] = positions[name];
    const size = Math.max(7, Math.min(10, (width - 10) / Math.max(font.widthOfTextAtSize(value, 10), 1) * 10));
    page.drawText(value, { x: x + 5, y: y + 4, size, font, color: rgb(0.08, 0.15, 0.32) });
  }
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

export async function downloadInternshipCertificate(student: Estagiario, internship: StudentInternship, client: Cliente): Promise<void> {
  const blob = await generateInternshipCertificate(student, internship, client);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'certificado-estagio-' + (student.cpf ?? 'estudante').replace(/\D/g, '') + '.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
