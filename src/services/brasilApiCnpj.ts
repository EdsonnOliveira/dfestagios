interface CnpjApiPayload {
  razaoSocial: string;
  nomeFantasia: string;
  email: string;
  municipio: string;
  bairro: string;
  cep: string;
  uf: string;
  logradouro: string;
  numero: string;
  complemento: string;
  phoneDigits: string;
  responsavel: string;
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

function mapApiPayloadToLookup(data: CnpjApiPayload): CnpjLookupMapped {
  const partesEnd = [data.logradouro.trim()];
  if (data.numero.trim()) partesEnd.push(`nº ${data.numero.trim()}`);
  if (data.complemento.trim()) partesEnd.push(data.complemento.trim());
  const endereco = partesEnd.filter(Boolean).join(', ');
  return {
    razaoSocial: data.razaoSocial,
    nomeFantasia: data.nomeFantasia,
    telefone: formatPhoneFromDigits(data.phoneDigits),
    email: data.email,
    cidade: data.municipio,
    bairro: data.bairro,
    cep: formatCepFromDigits(data.cep),
    endereco,
    uf: data.uf,
    responsavel: data.responsavel,
  };
}

async function fetchCnpjApiPayload(digits: string): Promise<CnpjApiPayload | null> {
  if (digits.length !== 14) return null;
  const res = await fetch(`/api/cnpj/${digits}`);
  if (!res.ok) return null;
  return (await res.json()) as CnpjApiPayload;
}

export async function fetchCnpjLookup(digits: string): Promise<CnpjLookupMapped | null> {
  const data = await fetchCnpjApiPayload(digits);
  if (!data?.razaoSocial?.trim()) return null;
  return mapApiPayloadToLookup(data);
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
  const data = await fetchCnpjApiPayload(digits);
  if (!data?.razaoSocial?.trim()) return null;
  const nome = formatInstitutionDisplayName(data.nomeFantasia || data.razaoSocial);
  const partesLinha1 = [data.logradouro.trim()];
  if (data.numero.trim()) partesLinha1.push(`nº ${data.numero.trim()}`);
  if (data.complemento.trim()) partesLinha1.push(data.complemento.trim());
  const linha1 = partesLinha1.filter(Boolean).join(', ');
  const cidadeUf =
    data.municipio && data.uf
      ? `${data.municipio} - ${data.uf}`
      : data.municipio || data.uf || '';
  const linha2 = [data.bairro, cidadeUf].filter(Boolean).join(', ');
  const endereco = [linha1, linha2].filter(Boolean).join(' - ');
  return {
    nome,
    cep: formatCepFromDigits(data.cep),
    endereco,
  };
}
