import 'server-only';

import { assertCan, type AuthenticatedUser } from '@/domain/auth/authorization';
import type { RoleCode } from '@/domain/auth/roles';
import { prisma } from '@/infrastructure/db/client';

/**
 * The administration screens' reads (CDC v0.1 §11).
 *
 * Each function asserts the permission itself rather than trusting the page: an
 * administration read is exactly the kind of thing that must not be reachable by
 * rendering a component in the wrong place (ADR-020).
 */

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  locale: string;
  lastLoginAt: Date | null;
  roles: { code: RoleCode; unitCode: string | null; unitName: string | null }[];
}

export async function listUsers(actor: AuthenticatedUser): Promise<AdminUserRow[]> {
  assertCan(actor, 'read', 'user');

  const users = await prisma.user.findMany({
    orderBy: { displayName: 'asc' },
    include: {
      userRoles: {
        include: {
          role: { select: { code: true } },
          scope: {
            select: { organizationUnit: { select: { code: true, nameFr: true } } },
          },
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
      code: assignment.role.code as RoleCode,
      unitCode: assignment.scope?.organizationUnit?.code ?? null,
      unitName: assignment.scope?.organizationUnit?.nameFr ?? null,
    })),
  }));
}

export interface AuditRow {
  id: string;
  createdAt: Date;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
}

/** The audit trail, newest first (§15). Capped so the page cannot be a full table scan. */
export async function listAuditTrail(actor: AuthenticatedUser, limit = 100): Promise<AuditRow[]> {
  assertCan(actor, 'read', 'audit_log');

  const rows = await prisma.auditLog.findMany({
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
export async function listRoles(actor: AuthenticatedUser) {
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
    permissions: role.permissions
      .map((link) => link.permission.code)
      .sort((a, b) => a.localeCompare(b)),
  }));
}

/** The organizational units, for the scope picker when granting a MANAGER role. */
export async function listUnitsForScope(actor: AuthenticatedUser) {
  assertCan(actor, 'read', 'organization_unit');

  return prisma.organizationUnit.findMany({
    where: { archivedAt: null },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, nameFr: true },
  });
}
