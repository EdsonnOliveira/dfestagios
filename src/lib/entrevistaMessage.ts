import type { Entrevista } from '../types/firebase';

const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

function formatInterviewDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAY_LABELS[date.getDay()] ?? '';
  const formatted = date.toLocaleDateString('pt-BR');
  return `${formatted} - ${weekday}`;
}

function formatRequisitos(requisitos: string): string {
  const lines = requisitos
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return '';
  return lines.map((line) => `• ${line.replace(/^[-•]\s*/, '')}`).join('\n');
}

export function buildEntrevistaWhatsappMessage(entrevista: Entrevista): string {
  const local = [entrevista.bairro, entrevista.cidade].filter(Boolean).join(', ');
  const requisitosBlock = formatRequisitos(entrevista.requisitos);
  const dataEntrevista = formatInterviewDate(entrevista.dataEntrevista);

  const parts = [
    `*Vaga de Estágio Disponível:* ${entrevista.tituloVaga.trim()}`,
    `📍 Local: ${local || entrevista.cidade}`,
    `⏰ Horário: ${entrevista.horarioTrabalho.trim()}`,
    `💰 Bolsa: ${entrevista.valorBolsa.trim()}`,
    `Atividades: ${entrevista.atividades.trim()}`,
    'Requisitos:',
    requisitosBlock,
    '📅 Entrevista:',
    `Data: ${dataEntrevista}`,
    `Horário: ${entrevista.horarioEntrevista.trim()}`,
    `Local: ${local || entrevista.cidade}`,
    'Caso atenda aos requisitos e consiga comparecer no horário informado *me confirme* aqui.',
  ];

  return parts.filter(Boolean).join('\n');
}

export function getWeekStartMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekdayDatesMonToFri(weekStart: Date): Date[] {
  return Array.from({ length: 5 }, (_, index) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + index);
    return d;
  });
}

export function parseHorarioTrabalho(horarioTrabalho: string): {
  entrada: string;
  saida: string;
} {
  const match = horarioTrabalho.match(
    /(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/
  );
  if (!match) {
    return { entrada: '', saida: '' };
  }
  const pad = (value: string) => {
    const [h, m] = value.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  };
  return { entrada: pad(match[1]), saida: pad(match[2]) };
}
