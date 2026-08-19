/**
 * Which database the test suites are allowed to destroy.
 *
 * Both the E2E and the API suites reseed before they run, which resets every demo
 * account's password. Pointed at a working database that is exactly what it sounds like:
 * a developer signs in the next morning and their password no longer works, because a
 * test run silently replaced it.
 *
 * So the suites read `TEST_DATABASE_URL`, never `DATABASE_URL`, and refuse to start if
 * the two resolve to the same database. The check compares host, port and database name
 * rather than the whole string, because the same database is routinely reachable through
 * two different URLs — a pooled and a direct Neon endpoint differ only in a hostname
 * infix, and credentials or query parameters differ for reasons that have nothing to do
 * with identity.
 */

export const TEST_DATABASE_ENV = 'TEST_DATABASE_URL';

interface DatabaseIdentity {
  host: string;
  port: string;
  database: string;
}

/** Host, port and database name — what actually decides whether two URLs are one database. */
function identify(url: string): DatabaseIdentity | null {
  try {
    const parsed = new URL(url);
    return {
      // Neon exposes one database through several endpoints whose hostnames differ only
      // by an infix: `ep-x-pooler.region…` and `ep-x.region…` are the same instance.
      host: parsed.hostname.replace('-pooler', '').toLowerCase(),
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, '').toLowerCase(),
    };
  } catch {
    return null;
  }
}

function sameDatabase(a: string, b: string): boolean {
  const left = identify(a);
  const right = identify(b);
  if (!left || !right) return a === b;
  return (
    left.host === right.host && left.port === right.port && left.database === right.database
  );
}

/**
 * The connection string the suites may reseed, or a thrown error explaining what to set.
 * Never falls back to `DATABASE_URL`: a fallback is precisely the behaviour this guards
 * against, and one that only bites when somebody forgot to set the variable is worse than
 * one that never bites at all.
 */
export function resolveTestDatabaseUrl(suite: string): string {
  const testUrl = process.env[TEST_DATABASE_ENV];

  if (!testUrl) {
    throw new Error(
      `${TEST_DATABASE_ENV} must be set to run the ${suite} suite.\n` +
        `\n` +
        `The suite applies migrations and reseeds, which resets every demo account's\n` +
        `password — so it must not be pointed at a database anybody is working against.\n` +
        `Create a throwaway database and add it to .env:\n` +
        `\n` +
        `  ${TEST_DATABASE_ENV}=postgresql://user:password@host:5432/soficlef_test\n`,
    );
  }

  const appUrl = process.env.DATABASE_URL;
  if (appUrl && sameDatabase(testUrl, appUrl)) {
    throw new Error(
      `${TEST_DATABASE_ENV} points at the same database as DATABASE_URL.\n` +
        `\n` +
        `Running the ${suite} suite would reseed it and reset every demo password.\n` +
        `Point ${TEST_DATABASE_ENV} at a separate, throwaway database.\n`,
    );
  }

  return testUrl;
}
