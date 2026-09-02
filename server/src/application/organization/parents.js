import { assertCan, scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';
import { descendantUnitIds } from '../../infrastructure/repositories/organization-unit-repository.js';

/**
 * The units a caller may attach a new structure under.
 * Ported from SoficlefPlatform src/application/organization/parents.ts.
 */
export async function assignableParents(user) {
  assertCan(user, 'create', 'organization_unit');

  const scope = scopeFilterFor(user, 'create', 'organization_unit');
  if (scope.kind === 'none' || scope.kind === 'self') return [];

  const allowed = scope.kind === 'units' ? await descendantUnitIds(scope.organizationUnitIds) : null;

  return prisma.organizationUnit.findMany({
    where: { archivedAt: null, ...(allowed ? { id: { in: allowed } } : {}) },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, nameFr: true },
  });
}
