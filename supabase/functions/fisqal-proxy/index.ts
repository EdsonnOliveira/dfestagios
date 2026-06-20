import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const FISQAL_BASE = 'https://api.fisqal.com.br';
const PANEL_ADMIN_EMAIL = 'contato.estagiosdf@gmail.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, idempotency-key, x-correlation-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function verifyFirebaseToken(
  idToken: string,
  firebaseApiKey: string
): Promise<{ email: string } | null> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: { email?: string }[] };
  const email = data.users?.[0]?.email;
  if (!email) return null;
  return { email };
}

function getRoutePath(url: URL): string {
  const pathname = url.pathname;
  const marker = '/fisqal-proxy';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return '/';
  const rest = pathname.slice(idx + marker.length);
  return rest || '/';
}

function buildFisqalUrl(path: string, search: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${FISQAL_BASE}${normalized}${search}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const fisqalApiKey = Deno.env.get('FISQAL_API_KEY');
  const companyId = Deno.env.get('FISQAL_COMPANY_ID');
  const firebaseApiKey = Deno.env.get('FIREBASE_WEB_API_KEY');

  if (!fisqalApiKey || !companyId || !firebaseApiKey) {
    return jsonResponse({ error: 'Server configuration incomplete' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const idToken = authHeader.slice(7);
  const user = await verifyFirebaseToken(idToken, firebaseApiKey);
  if (!user || user.email !== PANEL_ADMIN_EMAIL) {
    return jsonResponse({ error: 'Forbidden' }, 403);
  }

  const url = new URL(req.url);
  const routePath = getRoutePath(url);
  const fisqalHeaders: Record<string, string> = {
    Authorization: `Bearer ${fisqalApiKey}`,
    'X-API-Key': fisqalApiKey,
  };

  try {
    if (routePath === '/certificates' && req.method === 'GET') {
      const target = buildFisqalUrl(
        `/v1/companies/${companyId}/certificates`,
        url.search
      );
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    if (routePath === '/certificates' && req.method === 'POST') {
      const formData = await req.formData();
      const forward = new FormData();
      const nome = formData.get('nome');
      const password = formData.get('password');
      const file = formData.get('file');
      if (nome) forward.append('nome', String(nome));
      if (password) forward.append('password', String(password));
      if (file instanceof File) forward.append('file', file, file.name);

      const target = `${FISQAL_BASE}/v1/companies/${companyId}/certificates`;
      const res = await fetch(target, {
        method: 'POST',
        headers: fisqalHeaders,
        body: forward,
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    const certTestMatch = routePath.match(/^\/certificates\/([^/]+)\/test$/);
    if (certTestMatch && req.method === 'POST') {
      const certificateId = certTestMatch[1];
      const target = `${FISQAL_BASE}/v1/companies/${companyId}/certificates/${certificateId}/test`;
      const res = await fetch(target, { method: 'POST', headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    if (routePath === '/nfse/status/service' && req.method === 'GET') {
      const params = new URLSearchParams(url.search);
      if (!params.has('companyId')) {
        params.set('companyId', companyId);
      }
      const target = buildFisqalUrl(
        '/v1/nfse/status/service',
        `?${params.toString()}`
      );
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    const municipioMatch = routePath.match(
      /^\/nfse\/municipios\/([^/]+)\/cobertura$/
    );
    if (municipioMatch && req.method === 'GET') {
      const codigoIbge = municipioMatch[1];
      const target = buildFisqalUrl(
        `/v1/nfse/municipios/${codigoIbge}/cobertura`,
        url.search
      );
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    if (routePath === '/nfse' && req.method === 'GET') {
      const params = new URLSearchParams(url.search);
      if (!params.has('companyId')) {
        params.set('companyId', companyId);
      }
      const target = buildFisqalUrl('/v1/nfse', `?${params.toString()}`);
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    if (routePath === '/nfse' && req.method === 'POST') {
      const payload = await req.text();
      const headers: Record<string, string> = {
        ...fisqalHeaders,
        'Content-Type': 'application/json',
      };
      const idempotencyKey = req.headers.get('Idempotency-Key');
      const correlationId = req.headers.get('X-Correlation-Id');
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
      if (correlationId) headers['X-Correlation-Id'] = correlationId;

      let bodyPayload = payload;
      if (payload) {
        try {
          const parsed = JSON.parse(payload) as Record<string, unknown>;
          if (!parsed.companyId) parsed.companyId = companyId;
          bodyPayload = JSON.stringify(parsed);
        } catch {
          void 0;
        }
      }

      const res = await fetch(`${FISQAL_BASE}/v1/nfse`, {
        method: 'POST',
        headers,
        body: bodyPayload,
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    const nfseIdMatch = routePath.match(/^\/nfse\/([^/]+)$/);
    if (nfseIdMatch && req.method === 'GET') {
      const id = nfseIdMatch[1];
      const target = `${FISQAL_BASE}/v1/nfse/${id}`;
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    const nfseStatusMatch = routePath.match(/^\/nfse\/([^/]+)\/status$/);
    if (nfseStatusMatch && req.method === 'GET') {
      const id = nfseStatusMatch[1];
      const target = `${FISQAL_BASE}/v1/nfse/${id}/status`;
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    const nfseCancelMatch = routePath.match(/^\/nfse\/([^/]+)\/cancel$/);
    if (nfseCancelMatch && req.method === 'POST') {
      const id = nfseCancelMatch[1];
      const payload = await req.text();
      const res = await fetch(`${FISQAL_BASE}/v1/nfse/${id}/cancel`, {
        method: 'POST',
        headers: { ...fisqalHeaders, 'Content-Type': 'application/json' },
        body: payload,
      });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    const nfsePdfMatch = routePath.match(/^\/nfse\/([^/]+)\/pdf$/);
    if (nfsePdfMatch && req.method === 'GET') {
      const id = nfsePdfMatch[1];
      const target = `${FISQAL_BASE}/v1/nfse/${id}/pdf`;
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    const nfseXmlMatch = routePath.match(/^\/nfse\/([^/]+)\/xml$/);
    if (nfseXmlMatch && req.method === 'GET') {
      const id = nfseXmlMatch[1];
      const target = `${FISQAL_BASE}/v1/nfse/${id}/xml`;
      const res = await fetch(target, { headers: fisqalHeaders });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
        },
      });
    }

    return jsonResponse({ error: 'Not found', path: routePath }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 502);
  }
});
