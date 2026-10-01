import { defineConfig } from 'vitest/config';
import path from 'node:path';
import suites from './scripts/test-files.cjs';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': path.resolve('src') } },
  test: {
    include: suites.vitest,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 10000
  }
});
