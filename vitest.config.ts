import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.turbo', 'infra'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['services/**/*.ts', 'platform/**/*.ts', 'packages/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/dist/**', '**/node_modules/**'],
    },
  },
});
