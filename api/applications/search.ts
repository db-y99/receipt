import type { VercelRequest, VercelResponse } from '@vercel/node';
import { receiptAccess } from '../../server/auth.ts';

const APPLICATION_FIELDS = ['id', 'fullname', 'customer__code', 'code', 'phone', 'address'] as const;
const APPLICATION_SEARCH_LIMIT = 15;

function sessionUserId(req: VercelRequest): string | null {
  const fromCookie = req.cookies?.user_id;
  if (typeof fromCookie === 'string' && fromCookie.trim()) return fromCookie.trim();

  const header = req.headers.cookie;
  const raw = Array.isArray(header) ? header.join('; ') : header;
  if (!raw) return null;

  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== 'user_id') continue;
    try {
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      return value || null;
    } catch {
      return null;
    }
  }

  return null;
}

function buildApplicationSearchUrl(apiBaseUrl: string, query: string, login?: string): string {
  const params = new URLSearchParams({
    sort: '-id',
    limit: String(APPLICATION_SEARCH_LIMIT),
    values: APPLICATION_FIELDS.join(','),
    filter: JSON.stringify({ create_time__date__gte: '1927-12-03', status: 7 }),
    filter_or: JSON.stringify({
      fullname__icontains: query,
      code__icontains: query,
    }),
  });

  if (login) {
    params.set('login', login);
  }

  return `${apiBaseUrl.replace(/\/$/, '')}/data/Application/?${params.toString()}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiBaseUrl = process.env.API_BASE_URL || '';
  const userId = sessionUserId(req);

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const access = await receiptAccess(userId);
  if ('status' in access) {
    return res.status(access.status).json({ error: access.error });
  }

  if (!apiBaseUrl) {
    return res.status(503).json({ error: 'Chưa cấu hình API tìm kiếm' });
  }

  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (query.length < 2) {
    return res.status(200).json([]);
  }

  try {
    const targetUrl = buildApplicationSearchUrl(apiBaseUrl, query, userId);
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
