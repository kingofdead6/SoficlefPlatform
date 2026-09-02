import { z } from 'zod';

import { serverEnv } from '../../config/env.js';
import { dummyVerify, verifyPassword } from '../../infrastructure/auth/password.js';
import { createSessionToken } from '../../infrastructure/auth/session-token.js';
import { audit } from '../../infrastructure/repositories/audit-repository.js';
import { createSession } from '../../infrastructure/repositories/session-repository.js';
import { findUserByEmail, loadAuthenticatedUser } from '../../infrastructure/repositories/user-repository.js';
import { rateLimiter } from '../../infrastructure/security/rate-limit.js';
import { prisma } from '../../infrastructure/db/client.js';

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * Credentials login, ported from application/auth/login.ts. Same-shape-answer for
 * unknown email vs wrong password, IP+email rate limiting, every outcome audited.
 */
export async function login(raw, context) {
  const parsed = loginInput.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid-credentials' };
  const { email, password } = parsed.data;

  const env = serverEnv();
  const limits = { max: env.AUTH_LOGIN_MAX_ATTEMPTS, window: env.AUTH_LOGIN_WINDOW_SECONDS };

  const ipKey = context.ip ? `login:ip:${context.ip}` : null;
  const ipFailureLimit = env.AUTH_LOGIN_IP_MAX_FAILURES;

  const recordIpFailure = async () => {
    if (ipKey) await rateLimiter.consume(ipKey, ipFailureLimit, limits.window);
  };

  const byIp = ipKey
    ? await rateLimiter.check(ipKey, ipFailureLimit)
    : { allowed: true, remaining: 0, resetAt: new Date() };
  const byEmail = byIp.allowed
    ? await rateLimiter.consume(`login:email:${email}`, limits.max, limits.window)
    : { allowed: false, remaining: 0, resetAt: byIp.resetAt };

  if (!byEmail.allowed || !byIp.allowed) {
    await audit({
      actorId: null,
      actorLabel: email,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: null,
      before: null,
      after: { reason: 'rate-limited' },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return {
      ok: false,
      reason: 'rate-limited',
      retryAfter: byEmail.allowed ? byIp.resetAt : byEmail.resetAt,
    };
  }

  const record = await findUserByEmail(email);

  if (!record) {
    await dummyVerify(password);
    await recordIpFailure();
    await audit({
      actorId: null,
      actorLabel: email,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: null,
      before: null,
      after: { reason: 'unknown-email' },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: false, reason: 'invalid-credentials' };
  }

  const passwordMatches = await verifyPassword(record.passwordHash, password);
  if (!passwordMatches) {
    await recordIpFailure();
    await audit({
      actorId: record.id,
      actorLabel: `${record.displayName} <${record.email}>`,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: record.id,
      before: null,
      after: { reason: 'bad-password' },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: false, reason: 'invalid-credentials' };
  }

  if (record.status !== 'ACTIVE') {
    await recordIpFailure();
    await audit({
      actorId: record.id,
      actorLabel: `${record.displayName} <${record.email}>`,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: record.id,
      before: null,
      after: { reason: 'account-not-active', status: record.status },
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return { ok: false, reason: 'account-disabled' };
  }

  const user = await loadAuthenticatedUser(record.id);
  if (!user) return { ok: false, reason: 'invalid-credentials' };

  const token = createSessionToken();
  const session = await createSession({
    userId: user.id,
    token,
    ip: context.ip,
    userAgent: context.userAgent,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await rateLimiter.reset(`login:email:${email}`);

  await audit({
    actorId: user.id,
    actorLabel: `${user.displayName} <${user.email}>`,
    action: 'auth.login',
    entityType: 'session',
    entityId: session.id,
    before: null,
    after: { roles: user.assignments.map((assignment) => assignment.role) },
    ip: context.ip,
    userAgent: context.userAgent,
  });

  return { ok: true, token, expiresAt: session.expiresAt, user };
}
