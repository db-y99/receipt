import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logoutRequest } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const result = logoutRequest();
  if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
  return res.status(result.status).json(result.body);
}
