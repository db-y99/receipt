import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { applicationSearchProxy } from './plugins/applicationSearchProxy';
import { loanDueSoonProxy } from './plugins/loanDueSoonProxy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        applicationSearchProxy(env.API_BASE_URL || '', env.API_LOGIN || ''),
        loanDueSoonProxy(env.API_BASE_URL || '', env.API_LOGIN || ''),
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
