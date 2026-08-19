import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Vitest does not read .env, so DATABASE_URL would be undefined and the suite would
// refuse to start even against a perfectly reachable database.
import 'dotenv/config';

/**
 * Boots a real server for the API security suite: migrations, seed, then `next start`.
 *
 * Everything is torn down afterwards, and nothing here invents a credential — the demo
 * password is generated per run and passed through the environment (ADR-023).
 */

const PORT = Number(process.env.API_TEST_PORT ?? 3011);
export const BASE_URL = `http://127.0.0.1:${PORT}`;
export const DEMO_PASSWORD = 'Soficlef-Test-2026!';

let server: ChildProcess | undefined;

/**
 * Runs a node_modules CLI through the current Node binary.
 *
 * `npx` is a `.cmd` shim on Windows and cannot be spawned without a shell, so calling it
 * directly fails with ENOENT — and `migrate deploy` takes a Postgres advisory lock that a
 * connection left open by a previous run can still hold for a few seconds, hence the
 * retry. A genuinely unreachable database still fails on the last attempt.
 */
function run(
  cliSpecifier: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  attempts = 1,
): void {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = spawnSync(process.execPath, [require.resolve(cliSpecifier), ...args], {
      env,
      stdio: 'inherit',
    });
    if (result.status === 0) return;
    if (attempt === attempts) {
      throw new Error(`${cliSpecifier} ${args.join(' ')} failed with status ${result.status}`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5_000);
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/v1/auth/me`);
      // 401 is the expected answer for an anonymous caller: the server is up.
      if (response.status === 401 || response.ok) return;
    } catch {
      // not listening yet
    }
    await delay(300);
  }
  throw new Error(`server did not become ready at ${url}`);
}

export async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL must point at a PostgreSQL instance to run the API security suite',
    );
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    APP_URL: BASE_URL,
    AUTH_SESSION_SECRET:
      process.env.AUTH_SESSION_SECRET ?? 'test-session-secret-at-least-32-characters-long',
    SEED_DEMO_PASSWORD: DEMO_PASSWORD,
    // Low enough to exercise the limiter, high enough for the other suites.
    AUTH_LOGIN_MAX_ATTEMPTS: '5',
    AUTH_LOGIN_WINDOW_SECONDS: '900',
  };

  run('prisma/build/index.js', ['migrate', 'deploy'], env, 3);
  run('tsx/cli', ['prisma/seed.ts'], env, 2);

  server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--port', String(PORT)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[server] ${chunk}`));

  await waitForServer(BASE_URL, 60_000);
}

export async function teardown(): Promise<void> {
  if (!server) return;
  server.kill('SIGTERM');
  await delay(500);
  if (!server.killed) server.kill('SIGKILL');
}
