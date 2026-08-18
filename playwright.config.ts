import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite (ADR-015): authenticated journeys, locale switching, RTL rendering
 * and the screenshots used for visual comparison.
 *
 * The server is built and started by Playwright itself, so a run cannot pass against a
 * stale process. `PLAYWRIGHT_CHROMIUM_PATH` is an escape hatch for environments that ship
 * their own Chromium; unset, Playwright uses its own.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Applies migrations and seeds the demo accounts the suite signs in as.
  globalSetup: './tests/e2e/global-setup.ts',

  webServer: {
    command: `npx next start --port ${PORT}`,
    url: `${baseURL}/fr`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'production',
      APP_URL: baseURL,
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      AUTH_SESSION_SECRET:
        process.env.AUTH_SESSION_SECRET ?? 'e2e-session-secret-at-least-32-characters-long',
      // The suite screenshots the design-system pages, which are off by default in a
      // production build.
      ENABLE_DEV_PAGES: 'true',
      // The suite signs in as the seeded demo accounts.
      SEED_DEMO_PASSWORD: process.env.E2E_DEMO_PASSWORD ?? 'Soficlef-Test-2026!',
    },
  },
});
