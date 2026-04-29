export interface ViaCepPayload {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

export interface ViaCepMapped {
  enderecoCompleto: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export async function fetchCepLookup(digits: string): Promise<ViaCepMapped | null> {
  if (digits.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return null;
  const data = (await res.json()) as ViaCepPayload;
  if (data.erro) return null;
  const log = (data.logradouro ?? '').trim();
  const comp = (data.complemento ?? '').trim();
  const bairro = (data.bairro ?? '').trim();
  const cidade = (data.localidade ?? '').trim();
  const uf = (data.uf ?? '').trim();
  const line1 = [log, comp].filter(Boolean).join(', ');
  const cidadeUf = cidade && uf ? `${cidade} - ${uf}` : cidade || uf;
  const enderecoCompleto = [line1, cidadeUf].filter(Boolean).join(' - ');
  return {
    enderecoCompleto,
    bairro,
    cidade,
    uf
  };
}
