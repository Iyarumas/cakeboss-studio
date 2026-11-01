import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const domain = fileURLToPath(new URL('../../packages/domain/src', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // pure business rules (prices, cakes, store, promotions) shared with the server functions
  resolve: { alias: { '@cakeboss/domain': domain } },
  server: { fs: { allow: ['..', '../..'] } },
  test: {
    dir: fileURLToPath(new URL('../..', import.meta.url)),
    include: ['apps/web/src/**/*.test.ts', 'packages/domain/src/**/*.test.ts'],
  },
});
