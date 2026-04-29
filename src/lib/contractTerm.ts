export function contractEndDateOneYearAfterStart(startIso: string): Date | null {
  const parts = startIso.trim().split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const start = new Date(y, m, d);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  return end;
}

export function formatContractEndDatePtBr(startIso: string): string {
  const end = contractEndDateOneYearAfterStart(startIso);
  if (!end) return '';
  return end.toLocaleDateString('pt-BR');
}

export function hasCompletedOneYearContractTerm(
  startIso: string,
  now: Date = new Date()
): boolean {
  const end = contractEndDateOneYearAfterStart(startIso);
  if (!end) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return today >= endDay;
}
