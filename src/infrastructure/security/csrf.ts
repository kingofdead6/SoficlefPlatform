import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { serverEnv } from '@/lib/env';

/**
 * CSRF protection (CDC v0.1 §15): double-submit cookie plus an origin check.
 *
 * SameSite=Lax on the session cookie already blocks the classic cross-site form post;
 * this is the second layer, and it is the one that survives a browser that treats
 * SameSite differently.
 */

export const CSRF_COOKIE = 'soficlef_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The cookie is readable by script on purpose: the client must echo it in the header. */
export function csrfCookieOptions() {
  const isHttps = serverEnv().APP_URL.startsWith('https://');
  return { httpOnly: false, secure: isHttps, sameSite: 'lax' as const, path: '/' };
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type CsrfRejection = 'missing-token' | 'token-mismatch' | 'bad-origin';

/**
 * Verifies a mutating request. Safe methods pass untouched; everything else must carry a
 * header token matching the cookie, and an Origin (when the browser sends one) matching
 * the configured application URL.
 */
export function verifyCsrf(request: {
  method: string;
  headers: { get(name: string): string | null };
  cookieToken: string | null;
}): { ok: true } | { ok: false; reason: CsrfRejection } {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return { ok: true };

  const origin = request.headers.get('origin');
  if (origin !== null) {
    const expected = new URL(serverEnv().APP_URL).origin;
    if (origin !== expected) return { ok: false, reason: 'bad-origin' };
  }

  const header = request.headers.get(CSRF_HEADER);
  if (!header || !request.cookieToken) return { ok: false, reason: 'missing-token' };
  if (!constantTimeEquals(header, request.cookieToken))
    return { ok: false, reason: 'token-mismatch' };

  return { ok: true };
}

/** Signature helper for flows that cannot use a cookie, e.g. a future e-mail link. */
export function signValue(value: string): string {
  return createHmac('sha256', serverEnv().AUTH_SESSION_SECRET).update(value).digest('base64url');
}
