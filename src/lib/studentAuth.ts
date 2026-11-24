const STUDENT_AUTH_DOMAIN = 'alunos.df-estagios.invalid';

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

export function isStudentAccountEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${STUDENT_AUTH_DOMAIN}`));
}

export async function studentAuthEmail(cpf: string): Promise<string> {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) throw new Error('Informe um CPF válido.');
  const bytes = new TextEncoder().encode(digits);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const identifier = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${identifier}@${STUDENT_AUTH_DOMAIN}`;
}
