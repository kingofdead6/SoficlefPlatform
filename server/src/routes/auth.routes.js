import { Router } from 'express';

import { login } from '../application/auth/login.js';
import { logout } from '../application/auth/logout.js';
import { SESSION_COOKIE, sessionCookieOptions } from '../infrastructure/auth/session-token.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';

const router = Router();

function ipFromReq(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? null;
}

router.post('/login', async (req, res) => {
  const context = { ip: ipFromReq(req), userAgent: req.headers['user-agent'] ?? null };
  const result = await login(req.body, context);

  if (!result.ok) {
    const status = result.reason === 'rate-limited' ? 429 : 401;
    return res.status(status).json({ error: result.reason, retryAfter: result.retryAfter });
  }

  res.cookie(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
  return res.json({ user: publicUser(result.user) });
});

router.post('/logout', requireAuth, async (req, res) => {
  const context = { ip: ipFromReq(req), userAgent: req.headers['user-agent'] ?? null };
  await logout(req.user, req.sessionId, context);
  /*
   * clearCookie must be called with the same sameSite/secure attributes the cookie was set
   * with — a browser matches a Set-Cookie deletion against those attributes, not just the
   * name and path, so a mismatch (e.g. clearing without `secure`/`sameSite: 'none'` a cookie
   * that was set with them) can silently fail to remove it.
   */
  const { httpOnly, secure, sameSite, path } = sessionCookieOptions(new Date());
  res.clearCookie(SESSION_COOKIE, { httpOnly, secure, sameSite, path });
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  return res.json({ user: publicUser(req.user) });
});

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    status: user.status,
    lifecycleState: user.lifecycleState,
    onboardingStartDate: user.onboardingStartDate,
    avatarUrl: user.avatarUrl ?? null,
    roles: user.assignments.map((a) => a.role),
    assignments: user.assignments,
  };
}

export default router;
