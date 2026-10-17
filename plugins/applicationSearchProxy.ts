import type { Connect, Plugin } from 'vite';
import { buildApplicationSearchUrl } from '../api/lib/applicationSearchParams';
import { readUserIdFromHeader, receiptAccess } from '../api/lib/auth.ts';

function createSearchHandler(apiBaseUrl: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/applications/search')) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const userId = readUserIdFromHeader(req.headers.cookie);
    if (!userId) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not authenticated' }));
      return;
    }

    const access = await receiptAccess(userId);
    if (!access.ok) {
      res.statusCode = access.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: access.error }));
      return;
    }

    if (!apiBaseUrl) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Chưa cấu hình API tìm kiếm' }));
      return;
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const query = requestUrl.searchParams.get('q')?.trim() || '';

      if (query.length < 2) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify([]));
        return;
      }

      const targetUrl = buildApplicationSearchUrl(apiBaseUrl, query, userId);
      const response = await fetch(targetUrl);

      if (!response.ok) {
        res.statusCode = response.status;
        res.end(JSON.stringify({ error: `Tìm kiếm thất bại (${response.status})` }));
        return;
      }

      const payload = await response.text();
      res.setHeader('Content-Type', 'application/json');
      res.end(payload);
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Không thể kết nối API tìm kiếm' }));
    }
  };
}

export function applicationSearchProxy(apiBaseUrl: string): Plugin {
  const handler = createSearchHandler(apiBaseUrl);

  return {
    name: 'application-search-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
