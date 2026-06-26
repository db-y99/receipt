import type { VercelRequest, VercelResponse } from '@vercel/node';

const APPLICATION_FIELDS = ['id', 'fullname', 'customer__code', 'code', 'phone'] as const;
const APPLICATION_SEARCH_LIMIT = 15;

function buildApplicationSearchUrl(apiBaseUrl: string, query: string, login?: string): string {
  const params = new URLSearchParams({
    sort: '-id',
    limit: String(APPLICATION_SEARCH_LIMIT),
    values: APPLICATION_FIELDS.join(','),
    filter: JSON.stringify({ create_time__date__gte: '1927-12-03' }),
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
