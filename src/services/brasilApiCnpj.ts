const BRASIL_API_CNPJ = 'https://brasilapi.com.br/api/cnpj/v1';

export interface BrasilApiCnpjQsa {
  nome_socio: string;
  qualificacao_socio: string;
}

export interface BrasilApiCnpjPayload {
  razao_social?: string;
  nome_fantasia?: string;
  email?: string | null;
  municipio?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string;
  qsa?: BrasilApiCnpjQsa[];
}

export interface CnpjLookupMapped {
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  cidade: string;
  bairro: string;
  cep: string;
  endereco: string;
  uf: string;
  responsavel: string;
}

function formatPhoneFromDigits(numericValue: string): string {
  if (!numericValue) return '';
  let formattedValue = numericValue;
  if (numericValue.length > 0) {
    formattedValue = '(' + numericValue.substring(0, 2);
  }
  if (numericValue.length > 2) {
    formattedValue += ') ' + numericValue.substring(2, 7);
  }
  if (numericValue.length > 7) {
    formattedValue = formattedValue.substring(0, 10) + '-' + numericValue.substring(7, 11);
  }
  return formattedValue;
}

function formatCepFromDigits(digits: string): string {
  if (digits.length <= 5) return digits;
  return digits.substring(0, 5) + '-' + digits.substring(5, 8);
}

function extractPhoneDigits(data: BrasilApiCnpjPayload): string {
  const t1 = data.ddd_telefone_1?.replace(/\D/g, '') ?? '';
  const t2 = data.ddd_telefone_2?.replace(/\D/g, '') ?? '';
  const raw = (t1.length >= 8 ? t1 : '') || (t2.length >= 8 ? t2 : '');
  return raw.slice(0, 11);
}

function pickResponsavel(qsa: BrasilApiCnpjQsa[] | undefined): string {
  if (!qsa?.length) return '';
  const lower = (s: string) => s.toLowerCase();
  const byRole = (needle: string) =>
    qsa.find((s) => lower(s.qualificacao_socio).includes(needle));
  const chosen = byRole('presidente') || byRole('diretor') || qsa[0];
  const name = chosen?.nome_socio?.trim();
  return name ?? '';
}

export async function fetchCnpjLookup(digits: string): Promise<CnpjLookupMapped | null> {
  if (digits.length !== 14) return null;
  const res = await fetch(`${BRASIL_API_CNPJ}/${digits}`);
  if (!res.ok) return null;
  const data = (await res.json()) as BrasilApiCnpjPayload;
  const razao = (data.razao_social ?? '').trim();
  if (!razao) return null;
  const fantasiaRaw = (data.nome_fantasia ?? '').trim();
  const cepDigits = (data.cep ?? '').replace(/\D/g, '').slice(0, 8);
  const phoneDigits = extractPhoneDigits(data);
  const logradouro = (data.logradouro ?? '').trim();
  const numero = (data.numero ?? '').trim();
  const comp = (data.complemento ?? '').trim();
  const partesEnd = [logradouro];
  if (numero) partesEnd.push(`nº ${numero}`);
  if (comp) partesEnd.push(comp);
  const endereco = partesEnd.filter(Boolean).join(', ');
  return {
    razaoSocial: razao,
    nomeFantasia: fantasiaRaw || razao,
    telefone: formatPhoneFromDigits(phoneDigits),
    email: (data.email ?? '').trim(),
    cidade: (data.municipio ?? '').trim(),
    bairro: (data.bairro ?? '').trim(),
    cep: formatCepFromDigits(cepDigits),
    endereco,
    uf: (data.uf ?? '').trim().slice(0, 2).toUpperCase(),
    responsavel: pickResponsavel(data.qsa),
  };
}

export interface InstituicaoEnsinoMapped {
  nome: string;
  cep: string;
  endereco: string;
}

const LOWER_WORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas']);

function formatInstitutionDisplayName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return s
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && LOWER_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export async function fetchCnpjInstituicaoEnsino(
  digits: string
): Promise<InstituicaoEnsinoMapped | null> {
  if (digits.length !== 14) return null;
  const res = await fetch(`${BRASIL_API_CNPJ}/${digits}`);
  if (!res.ok) return null;
  const raw = (await res.json()) as Record<string, unknown>;
  const razao = String(raw.razao_social ?? '').trim();
  if (!razao) return null;
  const fantasia = String(raw.nome_fantasia ?? '').trim();
  const nome = formatInstitutionDisplayName(fantasia || razao);
  const cepDigits = String(raw.cep ?? '').replace(/\D/g, '').slice(0, 8);
  const logradouro = String(raw.logradouro ?? '').trim();
  const numero = String(raw.numero ?? '').trim();
  const comp = String(raw.complemento ?? '').trim();
  const bairro = String(raw.bairro ?? '').trim();
  const municipio = String(raw.municipio ?? '').trim();
  const uf = String(raw.uf ?? '')
    .trim()
    .slice(0, 2)
    .toUpperCase();
  const partesLinha1 = [logradouro];
  if (numero) partesLinha1.push(`nº ${numero}`);
  if (comp) partesLinha1.push(comp);
  const linha1 = partesLinha1.filter(Boolean).join(', ');
  const cidadeUf =
    municipio && uf ? `${municipio} - ${uf}` : municipio || uf || '';
  const linha2 = [bairro, cidadeUf].filter(Boolean).join(', ');
  const endereco = [linha1, linha2].filter(Boolean).join(' - ');
  return {
    nome,
    cep: formatCepFromDigits(cepDigits),
    endereco
  };
}
