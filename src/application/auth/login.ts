import 'server-only';

import { z } from 'zod';

import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { serverEnv } from '@/lib/env';
import { dummyVerify, verifyPassword } from '@/infrastructure/auth/password';
import { createSessionToken } from '@/infrastructure/auth/session-token';
import { audit } from '@/infrastructure/repositories/audit-repository';
import { createSession } from '@/infrastructure/repositories/session-repository';
import {
  findUserByEmail,
  loadAuthenticatedUser,
} from '@/infrastructure/repositories/user-repository';
import { rateLimiter } from '@/infrastructure/security/rate-limit';
import { prisma } from '@/infrastructure/db/client';

/** Parsed at the boundary, even though the form validates too (ADR-014). */
export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInput>;

export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date; user: AuthenticatedUser }
  | {
      ok: false;
      reason: 'invalid-credentials' | 'account-disabled' | 'rate-limited';
      retryAfter?: Date;
    };

/**
 * Credentials login (ADR-011).
 *
 * Three things are deliberate:
 *  - Wrong password and unknown e-mail return the same answer, and both spend the same
 *    time verifying a hash, so the endpoint is not an account-enumeration oracle.
 *  - Rate limiting is keyed on both the e-mail and the source address, so neither a
 *    password spray against one account nor a spread across many gets a free pass
 *    (CDC v0.1 §15). The address counter records failures only: a whole plant can sit
 *    behind one VPN egress, and a successful sign-in must never cost a colleague theirs.
 *  - Every outcome is audited, including the failures (ADR-022).
 */
export async function login(raw: unknown, context: LoginContext): Promise<LoginResult> {
  const parsed = loginInput.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'invalid-credentials' };
  const { email, password } = parsed.data;

  const env = serverEnv();
  const limits = { max: env.AUTH_LOGIN_MAX_ATTEMPTS, window: env.AUTH_LOGIN_WINDOW_SECONDS };

  const ipKey = context.ip ? `login:ip:${context.ip}` : null;
  const ipFailureLimit = env.AUTH_LOGIN_IP_MAX_FAILURES;

  /** Records a failed attempt against the source address. */
  const recordIpFailure = async (): Promise<void> => {
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
    // Same work, same shape of answer as a wrong password.
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
