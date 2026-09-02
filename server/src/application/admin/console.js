import { connectorStatuses } from '../../domain/admin/connectors.js';
import { assertCanAnyScope } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * The administrator's console (`/admin`). Ported from
 * SoficlefPlatform src/application/admin/console.ts.
 *
 * Everything here is measured rather than declared: active sessions are counted rows,
 * the error rate comes from the audit trail, and a connector's state is read from the
 * environment.
 */
export async function loadAdminConsole(user) {
  assertCanAnyScope(user, 'read', 'user');

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);

  const [
    activeSessions,
    sessionsLast24h,
    onlineUsers,
    failedLogins24h,
    accessDenied24h,
    accountsActive,
    accountsPending,
    accountsSuspended,
    openAccountRequests,
    storedDocuments,
    storedFiles,
    auditRows,
    lastEntry,
  ] = await Promise.all([
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }).catch(() => 0),
    prisma.session.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.session
      .findMany({ where: { revokedAt: null, expiresAt: { gt: now } }, select: { userId: true }, distinct: ['userId'] })
      .then((rows) => rows.length)
      .catch(() => 0),
    prisma.auditLog.count({ where: { action: 'auth.login_failed', createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.auditLog.count({ where: { action: 'access.denied', createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.user.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
    prisma.user.count({ where: { lifecycleState: 'PENDING_ASSIGNMENT', status: 'ACTIVE' } }).catch(() => 0),
    prisma.user.count({ where: { status: { not: 'ACTIVE' } } }).catch(() => 0),
    prisma.accountRequest.count({ where: { status: 'OPEN' } }).catch(() => 0),
    prisma.document.count().catch(() => 0),
    prisma.personalFile.count().catch(() => 0),
    prisma.auditLog.count().catch(() => 0),
    prisma.auditLog.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null),
  ]);

  return {
    activeSessions,
    sessionsLast24h,
    distinctUsersOnline: onlineUsers,
    failedLogins24h,
    accessDenied24h,
    accountsActive,
    accountsPending,
    accountsSuspended,
    openAccountRequests,
    storedDocuments,
    storedFiles,
    auditRows,
    connectors: connectorStatuses(process.env),
    lastActivityAt: lastEntry?.createdAt ?? null,
  };
}

/** Live sessions, for the console's detail panel. */
export async function listActiveSessions(user, limit = 20) {
  assertCanAnyScope(user, 'read', 'user');

  return prisma.session
    .findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      take: limit,
      select: {
        id: true,
        ip: true,
        userAgent: true,
        lastSeenAt: true,
        createdAt: true,
        expiresAt: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    })
    .catch(() => []);
}

/** The two-sided provisioning view: what HR asked for, and what SI created but nobody placed. */
export async function loadProvisioningQueue(user) {
  assertCanAnyScope(user, 'read', 'user');

  const now = Date.now();
  const age = (from) => Math.floor((now - from.getTime()) / 86_400_000);

  const [requests, unplaced] = await Promise.all([
    prisma.accountRequest
      .findMany({
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          candidateNameFr: true,
          plannedPositionFr: true,
          plannedHireDate: true,
          urgency: true,
          createdAt: true,
          requestedBy: { select: { displayName: true } },
        },
      })
      .catch(() => []),
    prisma.user
      .findMany({
        where: { lifecycleState: 'PENDING_ASSIGNMENT', status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
        select: { id: true, displayName: true, email: true, createdAt: true },
      })
      .catch(() => []),
  ]);

  return {
    requests: requests.map((request) => ({ ...request, waitingDays: age(request.createdAt) })),
    unplaced: unplaced.map((account) => ({ ...account, waitingDays: age(account.createdAt) })),
  };
}
