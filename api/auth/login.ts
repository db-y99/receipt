import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loginRequest } from '../lib/auth.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const result = await loginRequest(process.env.API_BASE_URL || '', req.body);
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
  return res.status(result.status).json(result.body);
}
