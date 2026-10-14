import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    fileParallelism: false,
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@sideband/contracts/events': path.resolve(__dirname, './packages/contracts/src/events.ts'),
      '@sideband/contracts': path.resolve(__dirname, './packages/contracts/src/index.ts'),
    },
  },
});
