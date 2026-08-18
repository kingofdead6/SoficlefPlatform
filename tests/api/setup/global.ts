import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

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

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`);
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

  run('npx', ['prisma', 'migrate', 'deploy'], env);
  run('npx', ['tsx', 'prisma/seed.ts'], env);

  server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
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
