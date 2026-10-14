import type { NextApiRequest, NextApiResponse } from 'next';
import { lookupCnpjOnServer } from '../../../server/cnpjLookup';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const raw = typeof req.query.cnpj === 'string' ? req.query.cnpj : '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 14) {
    res.status(400).json({ error: 'CNPJ inválido' });
    return;
  }
  try {
    const data = await lookupCnpjOnServer(digits);
    if (!data) {
      res.status(404).json({ error: 'CNPJ não encontrado' });
      return;
    }
    res.status(200).json(data);
  } catch (error) {
    console.error('CNPJ lookup failed:', error);
    res.status(502).json({ error: 'Falha ao consultar CNPJ' });
  }
}
