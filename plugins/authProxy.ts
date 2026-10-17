import type { IncomingMessage } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { loginRequest, logoutRequest, meRequest } from '../api/lib/auth.ts';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function pathnameOf(url: string | undefined): string {
  return (url || '').split('?')[0].replace(/\/+$/, '') || '/';
}

function createAuthHandler(apiBaseUrl: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const pathname = pathnameOf(req.url);
    if (
      pathname !== '/api/auth/login' &&
      pathname !== '/api/auth/me' &&
      pathname !== '/api/auth/logout'
    ) {
      next();
      return;
    }

    try {
      let result;
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        const raw = await readBody(req);
        result = await loginRequest(apiBaseUrl, raw);
      } else if (pathname === '/api/auth/me' && req.method === 'GET') {
        result = await meRequest(apiBaseUrl, req.headers.cookie);
      } else if (pathname === '/api/auth/logout' && req.method === 'POST') {
        result = logoutRequest();
      } else {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
        return;
      }

      if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(result.body));
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Không đăng nhập được. Thử lại sau.' }));
    }
  };
}

export function authProxy(apiBaseUrl: string): Plugin {
  const handler = createAuthHandler(apiBaseUrl);

  return {
    name: 'auth-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
