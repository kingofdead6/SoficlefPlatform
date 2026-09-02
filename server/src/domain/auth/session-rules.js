/**
 * Session lifetime rules, as pure functions (ported from session-rules.ts).
 */

export const DEFAULT_SESSION_POLICY = {
  ttlSeconds: 12 * 60 * 60,
  renewWindowSeconds: 60 * 60,
};

export function evaluateSession(session, now) {
  if (session.revokedAt !== null) return { valid: false, reason: 'revoked' };
  if (session.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: 'expired' };
  return { valid: true, shouldRenew: false };
}

export function shouldRenew(session, now, policy) {
  return now.getTime() - session.lastSeenAt.getTime() >= policy.renewWindowSeconds * 1000;
}

export function nextExpiry(now, policy) {
  return new Date(now.getTime() + policy.ttlSeconds * 1000);
}
