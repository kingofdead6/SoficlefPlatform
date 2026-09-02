import { evaluateSession, nextExpiry, shouldRenew } from '../../domain/auth/session-rules.js';
import { serverEnv } from '../../config/env.js';
import { prisma } from '../db/client.js';
import { hashSessionToken } from '../auth/session-token.js';

export function sessionPolicy() {
  const env = serverEnv();
  return {
    ttlSeconds: env.AUTH_SESSION_TTL_SECONDS,
    renewWindowSeconds: env.AUTH_SESSION_RENEW_WINDOW_SECONDS,
  };
}

export async function createSession({ userId, token, ip, userAgent }) {
  const expiresAt = nextExpiry(new Date(), sessionPolicy());
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      ip,
      userAgent,
    },
    select: { id: true, expiresAt: true },
  });
  return session;
}

/**
 * Resolves a session token. The row is read on every request, which is what makes
 * revocation take effect on the next request rather than at token expiry.
 */
export async function resolveSession(token) {
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

export async function revokeSession(sessionId) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessionsForUser(userId) {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}
