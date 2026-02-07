import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
    setupFiles: [],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@opensalesai/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
