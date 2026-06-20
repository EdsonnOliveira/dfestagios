import { auth } from '../lib/firebase';
import {
  CancelNfseDto,
  CancelNfseResponse,
  CertificateTestResponse,
  CertificateUploadResponse,
  CreateNfseDpsDto,
  EmitNfseResponse,
  FisqalCertificate,
  MunicipioCobertura,
  NfseServiceStatus,
  NfseStatusTimeline,
} from '../types/fisqal';

class FisqalApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getProxyBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada');
  }
  return `${url.replace(/\/$/, '')}/functions/v1/fisqal-proxy`;
}

async function getAuthHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado');
  }
  const token = await user.getIdToken();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return {
    Authorization: `Bearer ${token}`,
    ...(anonKey ? { apikey: anonKey } : {}),
    ...extra,
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!res.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof (payload as { message: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : typeof payload === 'string'
          ? payload
          : `Erro FISQAL (${res.status})`;
    throw new FisqalApiError(message, res.status);
  }
  return payload as T;
}

async function proxyRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = await getAuthHeaders(
    init?.headers as Record<string, string> | undefined
  );
  const res = await fetch(`${getProxyBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  return parseResponse<T>(res);
}

export const fisqalService = {
  async listCertificates(): Promise<FisqalCertificate[]> {
    return proxyRequest<FisqalCertificate[]>('/certificates', { method: 'GET' });
  },

  async uploadCertificate(
    nome: string,
    password: string,
    file: File
  ): Promise<CertificateUploadResponse> {
    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('password', password);
    formData.append('file', file, file.name);
    const headers = await getAuthHeaders();
    const res = await fetch(`${getProxyBaseUrl()}/certificates`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return parseResponse<CertificateUploadResponse>(res);
  },

  async testCertificate(certificateId: string): Promise<CertificateTestResponse> {
    return proxyRequest<CertificateTestResponse>(
      `/certificates/${certificateId}/test`,
      { method: 'POST' }
    );
  },

  async emitNfse(
    payload: CreateNfseDpsDto,
    idempotencyKey?: string
  ): Promise<EmitNfseResponse> {
    const extra: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (idempotencyKey) {
      extra['Idempotency-Key'] = idempotencyKey;
    }
    return proxyRequest<EmitNfseResponse>('/nfse', {
      method: 'POST',
      headers: extra,
      body: JSON.stringify(payload),
    });
  },

  async getNfseStatus(dpsId: string): Promise<NfseStatusTimeline> {
    return proxyRequest<NfseStatusTimeline>(`/nfse/${dpsId}/status`, {
      method: 'GET',
    });
  },

  async cancelNfse(
    dpsId: string,
    payload: CancelNfseDto
  ): Promise<CancelNfseResponse> {
    return proxyRequest<CancelNfseResponse>(`/nfse/${dpsId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getNfsePdfUrl(dpsId: string): Promise<string> {
    return proxyRequest<string>(`/nfse/${dpsId}/pdf`, { method: 'GET' });
  },

  async getNfseXmlUrl(dpsId: string): Promise<string> {
    return proxyRequest<string>(`/nfse/${dpsId}/xml`, { method: 'GET' });
  },

  async getMunicipioCobertura(
    codigoIbge: string,
    fiscalAmbiente?: string
  ): Promise<MunicipioCobertura> {
    const params = fiscalAmbiente
      ? `?fiscalAmbiente=${encodeURIComponent(fiscalAmbiente)}`
      : '';
    return proxyRequest<MunicipioCobertura>(
      `/nfse/municipios/${codigoIbge}/cobertura${params}`,
      { method: 'GET' }
    );
  },

  async getServiceStatus(): Promise<NfseServiceStatus> {
    return proxyRequest<NfseServiceStatus>('/nfse/status/service', {
      method: 'GET',
    });
  },
};

export { FisqalApiError };
