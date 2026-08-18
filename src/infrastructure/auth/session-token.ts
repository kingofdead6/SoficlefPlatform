import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { serverEnv } from '@/lib/env';

/**
 * The session cookie carries an opaque random token. Only its HMAC is stored, so a
 * database leak yields no usable session — the attacker would still need the secret,
 * which lives in the environment (ADR-011, ADR-023).
 */

export const SESSION_COOKIE = 'soficlef_session';

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHmac('sha256', serverEnv().AUTH_SESSION_SECRET).update(token).digest('hex');
}

/** Constant-time comparison, for the rare path that compares two hashes directly. */
export function tokenHashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Cookie attributes. `secure` is dropped only for plain-http local development. */
export function sessionCookieOptions(expiresAt: Date) {
  const isHttps = serverEnv().APP_URL.startsWith('https://');
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
}
