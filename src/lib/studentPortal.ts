import type { Cliente, Entrevista, EntrevistaCandidato, Estagiario, RelatorioAdministrativoEvento, VinculacaoEstagiario } from '../types/firebase';

export type StudentInternship = {
  id: string;
  client: Cliente | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
  tcePath: string | null;
  durationDays: number;
  certificateEligible: boolean;
};

export type StudentInterview = {
  candidate: EntrevistaCandidato;
  interview: Entrevista;
  moment: Date | null;
  past: boolean;
  daysRemaining: number | null;
};

export function normalizePhone(value: string | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}

export function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  return result.getUTCFullYear() === year && result.getUTCMonth() === month - 1 && result.getUTCDate() === day ? result : null;
}

export function formatIsoDate(value: string | null | undefined): string {
  const date = parseIsoDate(value ?? undefined);
  return date ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date) : '—';
}

function isoTodayInBrasilia(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function certificateEligibility(start: string, end: string | null, now = new Date()): { eligible: boolean; days: number } {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end ?? isoTodayInBrasilia(now));
  if (!startDate || !endDate || endDate < startDate) return { eligible: false, days: 0 };
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();
  const day = startDate.getUTCDate();
  const sixthMonth = new Date(Date.UTC(year, month + 6, 1));
  const lastDay = new Date(Date.UTC(year, month + 7, 0)).getUTCDate();
  sixthMonth.setUTCDate(Math.min(day, lastDay));
  return {
    eligible: endDate >= sixthMonth,
    days: Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1,
  };
}

export function buildStudentInternships(
  profile: Estagiario,
  links: VinculacaoEstagiario[],
  events: RelatorioAdministrativoEvento[],
  clients: Cliente[],
  now = new Date()
): StudentInternship[] {
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const contracts = events.filter((event) => event.tipo === 'contrato').sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));
  const terminations = events.filter((event) => event.tipo === 'rescisao').sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));
  const rows: StudentInternship[] = [];
  const source = links.length ? links : contracts.map((event) => ({
    id: event.id,
    clienteId: event.clienteId,
    estagiarioId: event.estagiarioId,
    dataVinculacao: event.createdAt,
    status: terminations.some((item) => item.clienteId === event.clienteId && item.dataReferencia >= event.dataReferencia) ? 'inativo' : 'ativo',
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  } as VinculacaoEstagiario));

  for (const [index, link] of source.entries()) {
    const linkDate = link.dataVinculacao instanceof Date ? link.dataVinculacao : typeof link.dataVinculacao === 'object' && link.dataVinculacao && 'toDate' in link.dataVinculacao ? (link.dataVinculacao as { toDate: () => Date }).toDate() : null;
    const fallbackStart = linkDate && !Number.isNaN(linkDate.getTime()) ? isoTodayInBrasilia(linkDate) : '';
    const matchingContract = [...contracts].reverse().find((event) => event.clienteId === link.clienteId);
    const startDate =
      (index === 0 ? profile.estagioDataInicio?.trim() : '') ||
      matchingContract?.dataReferencia?.trim() ||
      profile.estagioDataInicio?.trim() ||
      fallbackStart;
    if (!parseIsoDate(startDate)) continue;
    const termination = terminations.find((event) => event.clienteId === link.clienteId && event.dataReferencia >= startDate);
    const endDate = termination?.dataReferencia ?? null;
    const active = link.status === 'ativo' && !endDate;
    const eligibility = certificateEligibility(startDate, endDate, now);
    rows.push({
      id: link.id ?? link.clienteId + '-' + startDate,
      client: clientsById.get(link.clienteId) ?? null,
      startDate,
      endDate,
      active,
      tcePath: link.contratoPdfDrivePath ?? (active && links.length === 1 ? profile.contratoPdfDrivePath ?? null : null),
      durationDays: !active && !endDate ? 0 : eligibility.days,
      certificateEligible: Boolean((active || endDate) && eligibility.eligible),
    });
  }
  return rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function parseInterviewMoment(interview: Entrevista): Date | null {
  if (!parseIsoDate(interview.dataEntrevista)) return null;
  const match = interview.horarioEntrevista.match(/(\d{1,2})(?::|h)(\d{2})|(\d{1,2})h/);
  if (!match) return null;
  const hour = Number(match[1] ?? match[3]);
  const minute = Number(match[2] ?? '0');
  if (hour > 23 || minute > 59) return null;
  const date = new Date(interview.dataEntrevista + 'T' + String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0') + ':00-03:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildStudentInterviews(candidates: EntrevistaCandidato[], interviews: Entrevista[], phone: string, now = new Date()): StudentInterview[] {
  const byId = new Map(interviews.map((interview) => [interview.id, interview]));
  return candidates
    .filter((candidate) => normalizePhone(candidate.telefone) === normalizePhone(phone))
    .map((candidate) => {
      const interview = byId.get(candidate.entrevistaId);
      if (!interview) return null;
      const moment = parseInterviewMoment(interview);
      return {
        candidate, interview, moment,
        past: interview.status !== 'agendada' || (moment !== null && moment <= now),
        daysRemaining: moment ? Math.max(0, Math.ceil((moment.getTime() - now.getTime()) / 86_400_000)) : null,
      };
    })
    .filter((row): row is StudentInterview => row !== null)
    .sort((a, b) => (a.moment?.getTime() ?? 0) - (b.moment?.getTime() ?? 0));
}
