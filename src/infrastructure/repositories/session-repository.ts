import 'server-only';

import {
  evaluateSession,
  nextExpiry,
  shouldRenew,
  type SessionPolicy,
} from '@/domain/auth/session-rules';
import { serverEnv } from '@/lib/env';

import { prisma } from '../db/client';
import { hashSessionToken } from '../auth/session-token';

export function sessionPolicy(): SessionPolicy {
  const env = serverEnv();
  return {
    ttlSeconds: env.AUTH_SESSION_TTL_SECONDS,
    renewWindowSeconds: env.AUTH_SESSION_RENEW_WINDOW_SECONDS,
  };
}

export async function createSession(input: {
  userId: string;
  token: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = nextExpiry(new Date(), sessionPolicy());
  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: hashSessionToken(input.token),
      expiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
    },
    select: { id: true, expiresAt: true },
  });
  return session;
}

export type SessionLookup =
  | { valid: true; sessionId: string; userId: string; expiresAt: Date }
  | { valid: false; reason: 'unknown' | 'revoked' | 'expired' };

/**
 * Resolves a session token. The row is read on every request, which is what makes
 * revocation take effect on the next request rather than at token expiry (ADR-011).
 * Sliding renewal is applied at most once per renewal window so an active user does not
 * cause a write per request.
 */
export async function resolveSession(token: string): Promise<SessionLookup> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true, lastSeenAt: true },
  });
  if (!session) return { valid: false, reason: 'unknown' };

  const now = new Date();
  const verdict = evaluateSession(session, now);
  if (!verdict.valid) return { valid: false, reason: verdict.reason };

  if (shouldRenew(session, now, sessionPolicy())) {
    const expiresAt = nextExpiry(now, sessionPolicy());
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now, expiresAt },
    });
    return { valid: true, sessionId: session.id, userId: session.userId, expiresAt };
  }

  return {
    valid: true,
    sessionId: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Used when an account is suspended or its password changes. */
export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
