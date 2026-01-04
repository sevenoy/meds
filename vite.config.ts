import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/meds/',
    server: {
      port: 5173,
      host: 'localhost',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
});

