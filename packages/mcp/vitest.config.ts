import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'mcp',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
