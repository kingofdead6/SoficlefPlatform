import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { serverEnv } from '../../config/env.js';

/**
 * The session cookie carries an opaque random token. Only its HMAC is stored, so a
 * database leak yields no usable session.
 */
export const SESSION_COOKIE = 'soficlef_session';

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHmac('sha256', serverEnv().AUTH_SESSION_SECRET).update(token).digest('hex');
}

export function tokenHashEquals(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Cookie attributes. `secure` is dropped only for plain-http local development. */
export function sessionCookieOptions(expiresAt) {
  const isHttps = serverEnv().APP_URL.startsWith('https://');
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  };
}
