export const ESTAGIO_FUNCAO_OUTRA = 'OUTRA';

export const ESTAGIO_FUNCAO_OPTIONS = [
  'AUXILIAR DE LOJA',
  'AUXILIAR DE PRODUÇÃO',
  'AUXILIAR ADMINISTRATIVO',
  'ATENDIMENTO',
  'MARKETING',
  'SOCIAL MEDIA',
  'OPERADOR(A) DE CAIXA',
  'REPOSITOR',
  'RECEPCIONISTA',
  ESTAGIO_FUNCAO_OUTRA,
] as const;

export type EstagioFuncaoOption = (typeof ESTAGIO_FUNCAO_OPTIONS)[number];

export function resolveEstagioFuncao(select: string, outra: string): string {
  if (select === ESTAGIO_FUNCAO_OUTRA) {
    return outra.trim().toUpperCase();
  }
  return select.trim().toUpperCase();
}

export function splitEstagioFuncao(stored: string): {
  funcaoSelect: string;
  funcaoOutra: string;
} {
  const normalized = stored.trim().toUpperCase();
  if (!normalized) {
    return { funcaoSelect: '', funcaoOutra: '' };
  }
  const fixed = ESTAGIO_FUNCAO_OPTIONS.find(
    (option) => option !== ESTAGIO_FUNCAO_OUTRA && option === normalized
  );
  if (fixed) {
    return { funcaoSelect: fixed, funcaoOutra: '' };
  }
  return { funcaoSelect: ESTAGIO_FUNCAO_OUTRA, funcaoOutra: normalized };
}
