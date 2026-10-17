import type { Connect, Plugin } from 'vite';
import { readUserIdFromHeader, receiptAccess } from '../api/lib/auth.ts';
import { buildLoanDueSoonUrl } from '../api/lib/loanDueSoonParams';

function createDueSoonHandler(apiBaseUrl: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/loans/due-soon')) {
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
    if ('status' in access) {
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
      const targetUrl = buildLoanDueSoonUrl(apiBaseUrl, userId);
      const response = await fetch(targetUrl);

      if (!response.ok) {
        res.statusCode = response.status;
        res.end(
          JSON.stringify({
            error: `Lấy danh sách khoản vay thất bại (${response.status})`,
          }),
        );
        return;
      }

      const payload = await response.text();
      res.setHeader('Content-Type', 'application/json');
      res.end(payload);
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Không thể kết nối API khoản vay' }));
    }
  };
}

export function loanDueSoonProxy(apiBaseUrl: string): Plugin {
  const handler = createDueSoonHandler(apiBaseUrl);

  return {
    name: 'loan-due-soon-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
