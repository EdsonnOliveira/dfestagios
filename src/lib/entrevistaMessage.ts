import type { Entrevista, EntrevistaCandidato, EntrevistaTipoEntrevista } from '../types/firebase';

const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda Feira',
  'Terça Feira',
  'Quarta Feira',
  'Quinta Feira',
  'Sexta Feira',
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
  return lines.map((line) => `- ${line.replace(/^[-•]\s*/, '')}`).join('\n');
}

function getLocalLabel(entrevista: Entrevista): string {
  return [entrevista.bairro, entrevista.cidade].filter(Boolean).join(', ') || entrevista.cidade;
}

function buildInterviewSection(
  entrevista: Entrevista,
  tipoEntrevista: EntrevistaTipoEntrevista
): string[] {
  const local = getLocalLabel(entrevista);

  if (tipoEntrevista === 'captacao') {
    return [
      '',
      '📅 *Entrevista:*',
      '',
      '*Data:* Á combinar',
      '',
      '*Horário:* Á combinar',
      '',
      `*Local:* ${local}`,
      '',
      '➡ Caso atenda aos requisitos e tenha interesse na vaga, *me confirme* aqui que vamos enviar seu currículo para a responsável da empresa e ela entrará em contato para analisar seu perfil e agendar a entrevista.',
    ];
  }

  const dataEntrevista = formatInterviewDate(entrevista.dataEntrevista);
  const horario = entrevista.horarioEntrevista.trim();

  if (tipoEntrevista === 'online') {
    return [
      '',
      '📅 *Entrevista:* Online via Google Meet',
      '',
      `*Data:* ${dataEntrevista}`,
      '',
      `*Horário:* ${horario}`,
      '',
      '*Local:* A entrevista será On-line pelo Google Meet',
      '',
      '➡ Caso atenda aos requisitos e consiga comparecer no horário informado, *me confirme* aqui que vamos confirmar sua presença na entrevista.',
    ];
  }

  return [
    '',
    '📅 *Entrevista:*',
    '',
    `*Data:* ${dataEntrevista}`,
    '',
    `*Horário:* ${horario}`,
    '',
    `*Local:* ${local}`,
    '',
    '➡ Caso atenda aos requisitos e consiga comparecer no horário informado, *me confirme* aqui que vamos te enviar a localização e os dados da entrevista.',
  ];
}

export function buildEntrevistaWhatsappMessage(entrevista: Entrevista): string {
  const tipoEntrevista = entrevista.tipoEntrevista ?? 'presencial';
  const local = getLocalLabel(entrevista);
  const requisitosBlock = formatRequisitos(entrevista.requisitos);

  const parts = [
    `*Vaga de Estágio Disponível:* ${entrevista.tituloVaga.trim()}`,
    '',
    `📍 *Local:* ${local}`,
    '',
    `⏰ *Horário:* ${entrevista.horarioTrabalho.trim()}`,
    '',
    `💰 *Bolsa:* ${entrevista.valorBolsa.trim()}`,
    ...(entrevista.beneficios?.trim()
      ? ['', `🎁 *Benefícios:* ${entrevista.beneficios.trim()}`]
      : []),
    '',
    '*Atividades:*',
    '',
    entrevista.atividades.trim(),
    '',
    '*Requisitos:*',
    '',
    requisitosBlock,
    ...buildInterviewSection(entrevista, tipoEntrevista),
  ];

  return parts.filter((line) => line !== undefined).join('\n');
}

export function buildEntrevistaConfirmacaoMessage(entrevista: Entrevista): string {
  const dataEntrevista = formatInterviewDate(entrevista.dataEntrevista);
  const horario = entrevista.horarioEntrevista.trim();
  const endereco = [entrevista.endereco, entrevista.bairro, entrevista.cidade]
    .filter(Boolean)
    .join(', ');
  const responsavel = entrevista.responsavelEntrevista?.trim() || '-';
  const mapsLink = entrevista.googleMapsLink?.trim() || '';

  const parts = [
    '📢 ENTREVISTA CONFIRMADA! ✅',
    '',
    'Olá! Temos uma ótima notícia: seu perfil foi selecionado e sua entrevista está confirmada. 🎯',
    '',
    `📌 Empresa: ${entrevista.empresaNome}`,
    `👤 Responsável pela entrevista: ${responsavel}`,
    '',
    `📅 Data: ${dataEntrevista}`,
    `⏰ Horário: ${horario}`,
    '',
    `📍 Endereço: ${endereco || '-'}`,
    '',
    '📝 Importante:',
    '• Leve seu currículo atualizado;',
    '• Chegue com alguns minutos de antecedência;',
    '• Ao chegar, informe que você foi encaminhado(a) pela DF ESTÁGIOS.',
  ];

  if (mapsLink) {
    parts.push('', '📍 Localização:', mapsLink);
  }

  parts.push(
    '',
    'Boa sorte na entrevista! 🤞✨',
    'DF ESTÁGIOS — conectando você às melhores oportunidades!'
  );

  return parts.join('\n');
}

export function getDataCalendario(entrevista: Entrevista): string {
  return entrevista.dataCalendario?.trim() || entrevista.dataEntrevista;
}

function getWeekdayShortFromIso(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  const labels = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
  ];
  return labels[date.getDay()] ?? '';
}

export function buildRelatorioDiario(
  isoDate: string,
  entrevistas: Entrevista[],
  candidatosByEntrevistaId: Map<string, EntrevistaCandidato[]>
): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date =
    year && month && day ? new Date(year, month - 1, day) : new Date(isoDate);
  const formattedDate = date.toLocaleDateString('pt-BR');
  const dayEntrevistas = entrevistas.filter(
    (item) => getDataCalendario(item) === isoDate
  );

  const lines = dayEntrevistas.map((entrevista) => {
    const candidatos = candidatosByEntrevistaId.get(entrevista.id ?? '') ?? [];
    const count = candidatos.length;
    const tipoEntrevista = entrevista.tipoEntrevista ?? 'presencial';

    if (tipoEntrevista === 'captacao') {
      return `${entrevista.empresaNome}: ${count} candidato${count === 1 ? '' : 's'} agendado${count === 1 ? '' : 's'} - Captação`;
    }

    const weekday = getWeekdayShortFromIso(entrevista.dataEntrevista);
    const horario = entrevista.horarioEntrevista.trim();
    const onlineSuffix = tipoEntrevista === 'online' ? ' (Online)' : '';

    return `${entrevista.empresaNome}: ${count} candidato${count === 1 ? '' : 's'} agendado${count === 1 ? '' : 's'} - ${weekday} às ${horario}${onlineSuffix}`;
  });

  return [
    'RELATÓRIO DIÁRIO',
    formattedDate,
    '',
    'ENTREVISTAS',
    ...lines,
  ].join('\n');
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
  const match = horarioTrabalho.match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (!match) {
    return { entrada: '', saida: '' };
  }
  const pad = (value: string) => {
    const [h, m] = value.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  };
  return { entrada: pad(match[1]), saida: pad(match[2]) };
}
