export type MensalidadeQuadroStatus = 'pago' | 'vencido' | 'aberto';

export interface MensalidadeQuadroItem {
  valor: number;
  status: MensalidadeQuadroStatus;
}

export interface MensalidadeQuadroDivergencia {
  applies: boolean;
  hasDivergence: boolean;
  ativosCount: number;
  valorPorEstagiario: number;
  expectedValor: number;
  openValores: number[];
}

export function parseMoneyValue(value: string | number | undefined | null): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value?.trim()) return 0;
  const cleaned = value
    .replace(/^\s*R\$\s*/i, '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getAtivosCount(estagiariosVinculadosCount: number): number {
  return estagiariosVinculadosCount;
}

export function shouldValidateMensalidadeQuadro(
  valorPorEstagiario: string | number | undefined | null,
  validarQuadroFinanceiro?: boolean | null
): boolean {
  if (validarQuadroFinanceiro === false) return false;
  return parseMoneyValue(valorPorEstagiario) > 0;
}

export function getMensalidadeQuadroDivergencia(params: {
  valorPorEstagiario?: string | number | null;
  validarQuadroFinanceiro?: boolean | null;
  ativosCount: number;
  mensalidades: MensalidadeQuadroItem[];
}): MensalidadeQuadroDivergencia {
  const valorPorEstagiario = parseMoneyValue(params.valorPorEstagiario);
  const applies = shouldValidateMensalidadeQuadro(
    params.valorPorEstagiario,
    params.validarQuadroFinanceiro
  );
  const expectedValor = roundMoney(params.ativosCount * valorPorEstagiario);
  const openValores = params.mensalidades
    .filter((item) => item.status === 'aberto')
    .map((item) => roundMoney(item.valor));

  if (!applies || openValores.length === 0) {
    return {
      applies,
      hasDivergence: false,
      ativosCount: params.ativosCount,
      valorPorEstagiario,
      expectedValor,
      openValores,
    };
  }

  const hasDivergence = openValores.some((valor) => valor !== expectedValor);

  return {
    applies,
    hasDivergence,
    ativosCount: params.ativosCount,
    valorPorEstagiario,
    expectedValor,
    openValores,
  };
}
