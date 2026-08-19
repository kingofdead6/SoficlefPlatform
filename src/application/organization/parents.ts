import 'server-only';

import { assertCan, scopeFilterFor, type AuthenticatedUser } from '@/domain/auth/authorization';
import { descendantUnitIds } from '@/infrastructure/repositories/organization-unit-repository';
import { prisma } from '@/infrastructure/db/client';

/**
 * The units a caller may attach a new structure under.
 *
 * Deliberately *not* in the `'use server'` actions module: every export of such a module
 * is a callable endpoint, and a list of the organization's units is exactly the kind of
 * thing that must not be reachable without a permission check (ADR-020).
 */
export async function assignableParents(user: AuthenticatedUser) {
  assertCan(user, 'create', 'organization_unit');

  const scope = scopeFilterFor(user, 'create', 'organization_unit');
  if (scope.kind === 'none' || scope.kind === 'self') return [];

  const allowed =
    scope.kind === 'units' ? await descendantUnitIds(scope.organizationUnitIds) : null;

  return prisma.organizationUnit.findMany({
    where: { archivedAt: null, ...(allowed ? { id: { in: allowed } } : {}) },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, nameFr: true },
  });
}
