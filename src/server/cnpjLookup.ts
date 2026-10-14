export interface CnpjNormalized {
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

type CnpjProviderId = 'cnpja' | 'cnpjws' | 'brasilapi' | 'receitaws';

const PROVIDER_ORDER: CnpjProviderId[] = ['cnpja', 'cnpjws', 'brasilapi', 'receitaws'];

function resolveProviderOrder(): CnpjProviderId[] {
  const primary = process.env.CNPJ_LOOKUP_PROVIDER?.trim().toLowerCase();
  if (!primary || primary === 'auto') {
    return PROVIDER_ORDER;
  }
  const id = primary as CnpjProviderId;
  if (!PROVIDER_ORDER.includes(id)) {
    return PROVIDER_ORDER;
  }
  return [id, ...PROVIDER_ORDER.filter((item) => item !== id)];
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (data.status === 429 || data.status === 'ERROR') return null;
  if (typeof data.message === 'string' && data.type === 'bad_request') return null;
  return data;
}

function pickResponsavelFromQualificacao(
  entries: { nome: string; qualificacao: string }[]
): string {
  if (!entries.length) return '';
  const lower = (s: string) => s.toLowerCase();
  const byRole = (needle: string) =>
    entries.find((entry) => lower(entry.qualificacao).includes(needle));
  const chosen = byRole('presidente') || byRole('diretor') || entries[0];
  return chosen.nome.trim();
}

function mapCnpja(data: Record<string, unknown>): CnpjNormalized | null {
  const company = data.company as Record<string, unknown> | undefined;
  const razao = String(company?.name ?? '').trim();
  if (!razao) return null;
  const fantasia = String(data.alias ?? '').trim();
  const address = (data.address ?? {}) as Record<string, unknown>;
  const phones = Array.isArray(data.phones) ? data.phones : [];
  const phoneRow = (phones[0] ?? {}) as Record<string, unknown>;
  const area = String(phoneRow.area ?? '').replace(/\D/g, '');
  const number = String(phoneRow.number ?? '').replace(/\D/g, '');
  const emails = Array.isArray(data.emails) ? data.emails : [];
  const emailRow = (emails[0] ?? {}) as Record<string, unknown>;
  const members = Array.isArray(company?.members) ? company.members : [];
  const qsa = members.map((row) => {
    const item = row as Record<string, unknown>;
    const person = (item.person ?? {}) as Record<string, unknown>;
    const role = (item.role ?? {}) as Record<string, unknown>;
    return {
      nome: String(person.name ?? '').trim(),
      qualificacao: String(role.text ?? '').trim(),
    };
  });
  return {
    razaoSocial: razao,
    nomeFantasia: fantasia || razao,
    email: String(emailRow.address ?? '').trim(),
    municipio: String(address.city ?? '').trim(),
    bairro: String(address.district ?? '').trim(),
    cep: String(address.zip ?? '').replace(/\D/g, '').slice(0, 8),
    uf: String(address.state ?? '').trim().slice(0, 2).toUpperCase(),
    logradouro: String(address.street ?? '').trim(),
    numero: String(address.number ?? '').trim(),
    complemento: String(address.details ?? '').trim(),
    phoneDigits: `${area}${number}`.slice(0, 11),
    responsavel: pickResponsavelFromQualificacao(qsa),
  };
}

function mapCnpjWs(data: Record<string, unknown>): CnpjNormalized | null {
  if (data.status) return null;
  const razao = String(data.razao_social ?? '').trim();
  if (!razao) return null;
  const estabelecimento = (data.estabelecimento ?? {}) as Record<string, unknown>;
  const cidade = (estabelecimento.cidade ?? {}) as Record<string, unknown>;
  const estado = (estabelecimento.estado ?? {}) as Record<string, unknown>;
  const ddd1 = String(estabelecimento.ddd1 ?? '').replace(/\D/g, '');
  const tel1 = String(estabelecimento.telefone1 ?? '').replace(/\D/g, '');
  const socios = Array.isArray(data.socios) ? data.socios : [];
  const qsa = socios.map((row) => {
    const item = row as Record<string, unknown>;
    const qual = (item.qualificacao_socio ?? {}) as Record<string, unknown>;
    return {
      nome: String(item.nome ?? '').trim(),
      qualificacao: String(qual.descricao ?? '').trim(),
    };
  });
  return {
    razaoSocial: razao,
    nomeFantasia: String(estabelecimento.nome_fantasia ?? '').trim() || razao,
    email: String(estabelecimento.email ?? '').trim(),
    municipio: String(cidade.nome ?? '').trim(),
    bairro: String(estabelecimento.bairro ?? '').trim(),
    cep: String(estabelecimento.cep ?? '').replace(/\D/g, '').slice(0, 8),
    uf: String(estado.sigla ?? '').trim().slice(0, 2).toUpperCase(),
    logradouro: String(estabelecimento.logradouro ?? '').trim(),
    numero: String(estabelecimento.numero ?? '').trim(),
    complemento: String(estabelecimento.complemento ?? '').trim(),
    phoneDigits: `${ddd1}${tel1}`.slice(0, 11),
    responsavel: pickResponsavelFromQualificacao(qsa),
  };
}

function mapBrasilApi(data: Record<string, unknown>): CnpjNormalized | null {
  const razao = String(data.razao_social ?? '').trim();
  if (!razao) return null;
  const qsaRaw = Array.isArray(data.qsa) ? data.qsa : [];
  const qsa = qsaRaw.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      nome: String(item.nome_socio ?? '').trim(),
      qualificacao: String(item.qualificacao_socio ?? '').trim(),
    };
  });
  const t1 = String(data.ddd_telefone_1 ?? '').replace(/\D/g, '');
  const t2 = String(data.ddd_telefone_2 ?? '').replace(/\D/g, '');
  const phoneDigits = ((t1.length >= 8 ? t1 : '') || (t2.length >= 8 ? t2 : '')).slice(0, 11);
  return {
    razaoSocial: razao,
    nomeFantasia: String(data.nome_fantasia ?? '').trim() || razao,
    email: String(data.email ?? '').trim(),
    municipio: String(data.municipio ?? '').trim(),
    bairro: String(data.bairro ?? '').trim(),
    cep: String(data.cep ?? '').replace(/\D/g, '').slice(0, 8),
    uf: String(data.uf ?? '').trim().slice(0, 2).toUpperCase(),
    logradouro: String(data.logradouro ?? '').trim(),
    numero: String(data.numero ?? '').trim(),
    complemento: String(data.complemento ?? '').trim(),
    phoneDigits,
    responsavel: pickResponsavelFromQualificacao(qsa),
  };
}

function mapReceitaWs(data: Record<string, unknown>): CnpjNormalized | null {
  if (data.status === 'ERROR') return null;
  const razao = String(data.nome ?? '').trim();
  if (!razao) return null;
  const qsaRaw = Array.isArray(data.qsa) ? data.qsa : [];
  const qsa = qsaRaw.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      nome: String(item.nome ?? '').trim(),
      qualificacao: String(item.qual ?? '').trim(),
    };
  });
  const telefone = String(data.telefone ?? '').replace(/\D/g, '').slice(0, 11);
  return {
    razaoSocial: razao,
    nomeFantasia: String(data.fantasia ?? '').trim() || razao,
    email: String(data.email ?? '').trim(),
    municipio: String(data.municipio ?? '').trim(),
    bairro: String(data.bairro ?? '').trim(),
    cep: String(data.cep ?? '').replace(/\D/g, '').slice(0, 8),
    uf: String(data.uf ?? '').trim().slice(0, 2).toUpperCase(),
    logradouro: String(data.logradouro ?? '').trim(),
    numero: String(data.numero ?? '').trim(),
    complemento: String(data.complemento ?? '').trim(),
    phoneDigits: telefone,
    responsavel: pickResponsavelFromQualificacao(qsa),
  };
}

async function fetchFromProvider(
  provider: CnpjProviderId,
  digits: string
): Promise<CnpjNormalized | null> {
  switch (provider) {
    case 'cnpja': {
      const data = await fetchJson(`https://open.cnpja.com/office/${digits}`);
      return data ? mapCnpja(data) : null;
    }
    case 'cnpjws': {
      const data = await fetchJson(`https://publica.cnpj.ws/cnpj/${digits}`);
      return data ? mapCnpjWs(data) : null;
    }
    case 'brasilapi': {
      const data = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      return data ? mapBrasilApi(data) : null;
    }
    case 'receitaws': {
      const data = await fetchJson(`https://receitaws.com.br/v1/cnpj/${digits}`);
      return data ? mapReceitaWs(data) : null;
    }
    default:
      return null;
  }
}

export async function lookupCnpjOnServer(digits: string): Promise<CnpjNormalized | null> {
  if (digits.length !== 14) return null;
  const order = resolveProviderOrder();
  for (const provider of order) {
    const mapped = await fetchFromProvider(provider, digits);
    if (mapped?.razaoSocial) {
      return mapped;
    }
  }
  return null;
}
