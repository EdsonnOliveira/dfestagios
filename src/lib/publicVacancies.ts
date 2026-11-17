import type { Entrevista } from '../types/firebase';

const CANDIDATE_WHATSAPP = '5561998109169';

function interviewMoment(entrevista: Entrevista): string | null {
  const date = entrevista.dataEntrevista?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const match = entrevista.horarioEntrevista?.match(/\b(\d{1,2})(?::|h)(\d{2})\b|\b(\d{1,2})h\b/);
  if (!match) return null;
  const hour = Number(match[1] ?? match[3]);
  const minute = Number(match[2] ?? '00');
  if (hour > 23 || minute > 59) return null;
  return `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function nowInBrasilia(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

export function getAvailableVacancies(entrevistas: Entrevista[], now = new Date()): Entrevista[] {
  const currentMoment = nowInBrasilia(now);
  return entrevistas
    .filter((entrevista) => {
      const moment = interviewMoment(entrevista);
      return entrevista.status === 'agendada' && moment !== null && moment > currentMoment;
    })
    .sort((a, b) => (interviewMoment(a) ?? '').localeCompare(interviewMoment(b) ?? ''));
}

export function vacancyLocation(entrevista: Entrevista): string {
  return [entrevista.bairro, entrevista.cidade].filter(Boolean).join(' · ') || 'Local a confirmar';
}

export function vacancyAudience(entrevista: Entrevista): 'mocas' | 'rapazes' | 'ambos' | null {
  if (entrevista.sexoVaga) return entrevista.sexoVaga;
  const requirements = entrevista.requisitos?.toLocaleLowerCase('pt-BR') ?? '';
  if (/\bsomente\s+(?:para\s+)?moças\b/.test(requirements)) return 'mocas';
  if (/\bsomente\s+(?:para\s+)?rapazes\b/.test(requirements)) return 'rapazes';
  return null;
}

export function vacancyWhatsAppUrl(entrevista: Entrevista): string {
  const local = entrevista.bairro || entrevista.cidade;
  const message = `Olá, vim pelo site e gostaria de me candidatar na vaga de ${entrevista.tituloVaga}${local ? `, (${local})` : ''}.`;
  return `https://wa.me/${CANDIDATE_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
