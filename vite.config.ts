import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { applicationSearchProxy } from './plugins/applicationSearchProxy';
import { authProxy } from './plugins/authProxy';
import { loanDueSoonProxy } from './plugins/loanDueSoonProxy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const) {
      if (env[key]) process.env[key] = env[key];
    }
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        authProxy(env.API_BASE_URL || ''),
        applicationSearchProxy(env.API_BASE_URL || ''),
        loanDueSoonProxy(env.API_BASE_URL || ''),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
