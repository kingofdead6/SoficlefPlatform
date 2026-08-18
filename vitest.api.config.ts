import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * API-level security tests. These run against a real server process over HTTP, because
 * "a manager cannot reach another structure by direct API call" is a claim about the
 * wire, not about a function (Part 3 acceptance).
 *
 * Requires a build (`npm run build`) and a reachable PostgreSQL; the global setup
 * applies migrations, seeds, and starts the server.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/api/**/*.test.ts'],
    globalSetup: ['tests/api/setup/global.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // The server keeps one in-memory rate-limit window, so the suites must not race.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@seed': fileURLToPath(new URL('./seed', import.meta.url)),
    },
  },
});
