import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://cheymae.github.io/rzbz-workspace/ in production.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/rzbz-workspace/' : '/',
  server: { port: 5173 },
}));
