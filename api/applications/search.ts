import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApplicationSearchUrl } from '../../server/applicationSearchParams';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiBaseUrl = process.env.API_BASE_URL || '';
  const apiLogin = process.env.API_LOGIN || '';

  if (!apiBaseUrl) {
    return res.status(503).json({ error: 'Chưa cấu hình API tìm kiếm' });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (query.length < 2) {
    return res.status(200).json([]);
  }

  try {
    const targetUrl = buildApplicationSearchUrl(apiBaseUrl, query, apiLogin);
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Tìm kiếm thất bại (${response.status})` });
    }

    const payload = await response.json();
    return res.status(200).json(payload);
  } catch {
    return res.status(500).json({ error: 'Không thể kết nối API tìm kiếm' });
  }
}
