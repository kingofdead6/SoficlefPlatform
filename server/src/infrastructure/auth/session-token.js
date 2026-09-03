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

/**
 * Cookie attributes.
 *
 * `sameSite: 'none'` is required, not optional, because the client and API are deployed on
 * different origins (Vercel front end, Render API) — every browser treats that as
 * cross-site, and a `Lax` cookie is withheld from cross-site fetch/XHR entirely (`Lax` only
 * rides along on top-level navigations). Without `None` the login response sets the cookie
 * but no later request ever sends it back, which is exactly the "every authenticated route
 * returns 401" symptom this fixes. `SameSite=None` requires `Secure` in every modern
 * browser, so the two are set together — `secure` can only be dropped for plain-http local
 * development, where the browser has no cross-site boundary to enforce in the first place
 * and `None` without `https` would be rejected outright.
 */
export function sessionCookieOptions(expiresAt) {
  const isHttps = serverEnv().APP_URL.startsWith('https://');
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
    expires: expiresAt,
  };
}
