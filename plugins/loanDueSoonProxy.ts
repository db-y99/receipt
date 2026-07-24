import type { Connect, Plugin } from 'vite';
import { buildLoanDueSoonUrl } from '../api/lib/loanDueSoonParams';

function createDueSoonHandler(apiBaseUrl: string, apiLogin: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/loans/due-soon')) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    if (!apiBaseUrl) {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: 'Chưa cấu hình API tìm kiếm' }));
      return;
    }

    try {
      const targetUrl = buildLoanDueSoonUrl(apiBaseUrl, apiLogin);
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

export function loanDueSoonProxy(apiBaseUrl: string, apiLogin: string): Plugin {
  const handler = createDueSoonHandler(apiBaseUrl, apiLogin);

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
