import type { VercelRequest, VercelResponse } from '@vercel/node';
import { meRequest } from '../lib/auth.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const result = await meRequest(process.env.API_BASE_URL || '', req.headers.cookie);
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
  return res.status(result.status).json(result.body);
}
