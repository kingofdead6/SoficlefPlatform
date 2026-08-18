/**
 * Session lifetime rules, as pure functions so they can be tested without a clock or a
 * database (ADR-011, ADR-019).
 */

export interface SessionPolicy {
  /** Absolute lifetime of a session, in seconds. */
  ttlSeconds: number;
  /**
   * Sliding expiry: a session seen again within this many seconds of its last renewal is
   * not renewed, so an active user does not cause a database write per request.
   */
  renewWindowSeconds: number;
}

export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  ttlSeconds: 12 * 60 * 60,
  renewWindowSeconds: 60 * 60,
};

export interface SessionState {
  expiresAt: Date;
  revokedAt: Date | null;
  lastSeenAt: Date;
}

export type SessionRejection = 'revoked' | 'expired';

/**
 * Revocation is checked before expiry so the reason reported is the true one. A revoked
 * session is refused on the very next request — the row is read on every request, which
 * is precisely what a stateless token cannot offer (ADR-011).
 */
export function evaluateSession(
  session: SessionState,
  now: Date,
): { valid: false; reason: SessionRejection } | { valid: true; shouldRenew: boolean } {
  if (session.revokedAt !== null) return { valid: false, reason: 'revoked' };
  if (session.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: 'expired' };
  return { valid: true, shouldRenew: false };
}

export function shouldRenew(session: SessionState, now: Date, policy: SessionPolicy): boolean {
  return now.getTime() - session.lastSeenAt.getTime() >= policy.renewWindowSeconds * 1000;
}

export function nextExpiry(now: Date, policy: SessionPolicy): Date {
  return new Date(now.getTime() + policy.ttlSeconds * 1000);
}
