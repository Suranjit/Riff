import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'server',
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Integration tests spin up real TLS servers and sockets; give them room.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
