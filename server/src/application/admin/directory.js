import { assertCan } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * The administration screens' reads (CDC v0.1 §11).
 * Ported from SoficlefPlatform src/application/admin/directory.ts.
 *
 * Each function asserts the permission itself rather than trusting the caller: an
 * administration read must not be reachable without a check (ADR-020).
 */

export async function listUsers(actor) {
  assertCan(actor, 'read', 'user');

  const users = await prisma.user.findMany({
    orderBy: { displayName: 'asc' },
    include: {
      userRoles: {
        include: {
          role: { select: { code: true } },
          scope: { select: { organizationUnit: { select: { code: true, nameFr: true } } } },
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    locale: user.locale,
    lastLoginAt: user.lastLoginAt,
    roles: user.userRoles.map((assignment) => ({
      code: assignment.role.code,
      unitCode: assignment.scope?.organizationUnit?.code ?? null,
      unitName: assignment.scope?.organizationUnit?.nameFr ?? null,
    })),
  }));
}

/** The audit trail, newest first (§15). Capped so the page cannot be a full table scan. */
export async function listAuditTrail(actor, limit = 100, filters = {}) {
  assertCan(actor, 'read', 'audit_log');

  const search = filters.search?.trim();
  const from = filters.from ? new Date(filters.from) : null;
  // `to` is inclusive of the whole day.
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : null;

  const rows = await prisma.auditLog.findMany({
    where: {
      ...(filters.action ? { action: filters.action } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(search
        ? {
            OR: [
              { actorLabel: { contains: search, mode: 'insensitive' } },
              { entityType: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
    select: {
      id: true,
      createdAt: true,
      actorLabel: true,
      action: true,
      entityType: true,
      entityId: true,
      ip: true,
    },
  });

  return rows;
}

/** The roles and the permissions each carries, for the permission matrix screen. */
export async function listRoles(actor) {
  assertCan(actor, 'read', 'role');

  const roles = await prisma.role.findMany({
    orderBy: { code: 'asc' },
    include: {
      permissions: { include: { permission: { select: { code: true } } } },
      _count: { select: { userRoles: true } },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    nameFr: role.nameFr,
    description: role.description,
    userCount: role._count.userRoles,
    permissions: role.permissions.map((link) => link.permission.code).sort((a, b) => a.localeCompare(b)),
  }));
}

/** The organizational units, for the scope picker when granting a MANAGER role. */
export async function listUnitsForScope(actor) {
  assertCan(actor, 'read', 'organization_unit');

  return prisma.organizationUnit.findMany({
    where: { archivedAt: null },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, nameFr: true },
  });
}
