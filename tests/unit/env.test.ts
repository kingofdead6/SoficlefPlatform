import { describe, expect, it } from 'vitest';

import { __serverSchema } from '@/lib/env';

const validEnv = () => ({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user@localhost:5432/soficlef',
  AUTH_SESSION_SECRET: 'a-secret-of-at-least-thirty-two-characters',
});

describe('server environment', () => {
  it('rejects a missing database URL rather than starting half-configured', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = validEnv();
    expect(__serverSchema.safeParse(withoutDatabase).success).toBe(false);
  });

  it('rejects a missing session secret', () => {
    const { AUTH_SESSION_SECRET: _omitted, ...withoutSecret } = validEnv();
    expect(__serverSchema.safeParse(withoutSecret).success).toBe(false);
  });

  it('rejects a database URL that is not a PostgreSQL URL', () => {
    // `new URL()` accepts "localhost:5432" as scheme "localhost:", so the protocol is
    // checked explicitly.
    const result = __serverSchema.safeParse({ ...validEnv(), DATABASE_URL: 'localhost:5432' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid configuration and defaults the app URL', () => {
    const result = __serverSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.APP_URL).toBe('http://localhost:3000');
  });

  it('refuses a session secret short enough to brute-force', () => {
    const result = __serverSchema.safeParse({ ...validEnv(), AUTH_SESSION_SECRET: 'too-short' });
    expect(result.success).toBe(false);
  });

  it('defaults the authentication policy so a deployment need only set the secrets', () => {
    const result = __serverSchema.safeParse(validEnv());
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.AUTH_PASSWORD_MIN_LENGTH).toBe(12);
    expect(result.data.AUTH_ARGON2_ITERATIONS).toBeGreaterThanOrEqual(2);
    // The per-account limit is strict; the per-address one counts failures only and is
    // deliberately looser, because a whole site can share a VPN egress (ADR-033).
    expect(result.data.AUTH_LOGIN_MAX_ATTEMPTS).toBe(5);
    expect(result.data.AUTH_LOGIN_IP_MAX_FAILURES).toBeGreaterThan(
      result.data.AUTH_LOGIN_MAX_ATTEMPTS,
    );
  });
});
