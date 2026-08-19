import { afterEach, describe, expect, it } from 'vitest';

import { resolveTestDatabaseUrl } from '../support/test-database';

/**
 * The guard that stops a test run from reseeding a working database.
 *
 * This exists because it already happened: an E2E run reseeded the development database
 * and reset every demo account's password, and the next sign-in failed with no obvious
 * cause. The rules below are what makes that impossible rather than merely unlikely.
 */

const APP = 'postgresql://user:pw@db.example.com:5432/soficlef';

afterEach(() => {
  delete process.env.TEST_DATABASE_URL;
  delete process.env.DATABASE_URL;
});

describe('resolveTestDatabaseUrl', () => {
  it('returns the test database when it is distinct from the application one', () => {
    process.env.DATABASE_URL = APP;
    process.env.TEST_DATABASE_URL = 'postgresql://user:pw@db.example.com:5432/soficlef_test';
    expect(resolveTestDatabaseUrl('E2E')).toBe(
      'postgresql://user:pw@db.example.com:5432/soficlef_test',
    );
  });

  it('refuses to run at all when the variable is unset', () => {
    process.env.DATABASE_URL = APP;
    // Deliberately no fallback to DATABASE_URL: a fallback is the very behaviour this
    // guards against, and one that only bites when somebody forgot is the worst kind.
    expect(() => resolveTestDatabaseUrl('E2E')).toThrow(/TEST_DATABASE_URL must be set/);
  });

  it('refuses when both point at the same database', () => {
    process.env.DATABASE_URL = APP;
    process.env.TEST_DATABASE_URL = APP;
    expect(() => resolveTestDatabaseUrl('E2E')).toThrow(/same database as DATABASE_URL/);
  });

  it('sees through differing credentials and query parameters', () => {
    process.env.DATABASE_URL = `${APP}?sslmode=require`;
    process.env.TEST_DATABASE_URL = 'postgresql://other:secret@db.example.com:5432/soficlef';
    expect(() => resolveTestDatabaseUrl('E2E')).toThrow(/same database/);
  });

  it('treats a Neon pooled endpoint as the same database as its direct one', () => {
    // The two differ only by a hostname infix, so a plain string comparison would call
    // them different databases and cheerfully reseed the live one.
    process.env.DATABASE_URL =
      'postgresql://u:p@ep-x-pooler.c-5.aws.neon.tech/neondb?sslmode=require';
    process.env.TEST_DATABASE_URL = 'postgresql://u:p@ep-x.c-5.aws.neon.tech/neondb';
    expect(() => resolveTestDatabaseUrl('API security')).toThrow(/same database/);
  });

  it('still distinguishes two different databases on the same host', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@ep-x-pooler.c-5.aws.neon.tech/neondb';
    process.env.TEST_DATABASE_URL = 'postgresql://u:p@ep-x.c-5.aws.neon.tech/neondb_test';
    expect(() => resolveTestDatabaseUrl('API security')).not.toThrow();
  });

  it('names the suite in the message, so the reader knows what refused to run', () => {
    expect(() => resolveTestDatabaseUrl('API security')).toThrow(/API security suite/);
  });
});
