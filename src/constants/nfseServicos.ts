export type NfseServicoOption = {
  code: string;
  label: string;
};

export const NFSE_SERVICO_OPTIONS: NfseServicoOption[] = [
  {
    code: '170501',
    label: '170501 — Fornecimento de mão-de-obra, inclusive temporária',
  },
  {
    code: '170101',
    label: '170101 — Assessoria ou consultoria de qualquer natureza',
  },
  {
    code: '080201',
    label: '080201 — Instrução, treinamento, orientação pedagógica e educacional',
  },
  {
    code: '010101',
    label: '010101 — Análise e desenvolvimento de sistemas',
  },
  {
    code: '010701',
    label: '010701 — Suporte técnico em informática',
  },
  {
    code: '170201',
    label: '170201 — Datilografia, digitação, estenografia e congêneres',
  },
  {
    code: '170401',
    label: '170401 — Recrutamento, agenciamento, seleção e colocação de mão-de-obra',
  },
];

export const DEFAULT_NFSE_SERVICO_CODE = '170501';

export function getNfseServicoOptions(
  currentCode?: string
): NfseServicoOption[] {
  const code = currentCode?.trim();
  if (!code) return NFSE_SERVICO_OPTIONS;
  if (NFSE_SERVICO_OPTIONS.some((item) => item.code === code)) {
    return NFSE_SERVICO_OPTIONS;
  }
  return [{ code, label: `${code} — Código personalizado` }, ...NFSE_SERVICO_OPTIONS];
}
