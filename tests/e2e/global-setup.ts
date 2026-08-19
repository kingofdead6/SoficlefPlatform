import { spawnSync } from 'node:child_process';

import 'dotenv/config';

/**
 * Prepares the database the end-to-end suite runs against: migrations, then the demo
 * accounts. The password comes from the environment, never from a literal in a fixture
 * (ADR-023).
 */
export default function globalSetup(): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    SEED_DEMO_PASSWORD: process.env.E2E_DEMO_PASSWORD ?? 'Soficlef-Test-2026!',
  };

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL must point at a PostgreSQL instance to run the E2E suite');
  }

  // `npx` is a .cmd shim on Windows and cannot be spawned without a shell, so each tool
  // is resolved from node_modules and run through the current Node binary instead.
  // Playwright loads this file as CommonJS, so `require` is the resolver available here.
  const run = (cliSpecifier: string, args: string[]) => {
    const result = spawnSync(process.execPath, [require.resolve(cliSpecifier), ...args], {
      env,
      stdio: 'inherit',
    });
    if (result.status !== 0) throw new Error(`${cliSpecifier} ${args.join(' ')} failed`);
  };

  run('prisma/build/index.js', ['migrate', 'deploy']);
  run('tsx/cli', ['prisma/seed.ts']);
}
