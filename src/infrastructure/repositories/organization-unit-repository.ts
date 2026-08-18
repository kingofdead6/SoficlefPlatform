import 'server-only';

import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { assertCan, scopeFilterFor } from '@/domain/auth/authorization';

import { prisma } from '../db/client';

/**
 * Organization units — the scope anchor, and the first entity the scope rules are
 * applied to. Part 7 builds the module on top of this repository.
 *
 * Every read takes the acting user and narrows the query itself (ADR-021). That is
 * deliberate friction: a query without a caller cannot be written by accident, so no
 * endpoint can over-fetch and rely on the UI to hide the surplus.
 */

export interface OrganizationUnitRecord {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string | null;
  nameEn: string | null;
  type: string;
  parentId: string | null;
  archivedAt: Date | null;
}

/**
 * A unit and every unit beneath it, resolved with a recursive CTE. A manager's scope is
 * their structure *and* what hangs under it: the head of Fabrication also covers the
 * Coffre and Brouette units.
 */
export async function descendantUnitIds(rootIds: string[]): Promise<string[]> {
  if (rootIds.length === 0) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM organization_unit WHERE id = ANY(${rootIds}::uuid[])
      UNION ALL
      SELECT child.id
      FROM organization_unit child
      JOIN subtree ON child."parentId" = subtree.id
    )
    SELECT id FROM subtree
  `;
  return rows.map((row) => row.id);
}

export async function listOrganizationUnits(
  user: AuthenticatedUser,
): Promise<OrganizationUnitRecord[]> {
  const filter = scopeFilterFor(user, 'read', 'organization_unit');

  // No permission anywhere: an empty list, not an error. A list endpoint showing nothing
  // is a correct answer; a 500 is not.
  if (filter.kind === 'none') return [];

  const where =
    filter.kind === 'units'
      ? { id: { in: filter.organizationUnitIds }, archivedAt: null }
      : filter.kind === 'self'
        ? // A SELF-scoped reader has no organizational breadth of their own.
          { id: { in: [] as string[] } }
        : { archivedAt: null };

  return prisma.organizationUnit.findMany({
    where,
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      nameFr: true,
      nameAr: true,
      nameEn: true,
      type: true,
      parentId: true,
      archivedAt: true,
    },
  });
}

/**
 * Reads one unit, or returns null when it is outside the caller's scope.
 *
 * Null rather than a thrown error, and the same null a missing row produces: a direct
 * URL must not reveal that a unit exists but is out of reach.
 */
export async function findOrganizationUnitForUser(
  user: AuthenticatedUser,
  id: string,
): Promise<OrganizationUnitRecord | null> {
  const filter = scopeFilterFor(user, 'read', 'organization_unit');
  if (filter.kind === 'none' || filter.kind === 'self') return null;
  if (filter.kind === 'units' && !filter.organizationUnitIds.includes(id)) return null;

  return prisma.organizationUnit.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      code: true,
      nameFr: true,
      nameAr: true,
      nameEn: true,
      type: true,
      parentId: true,
      archivedAt: true,
    },
  });
}

export interface UpdateOrganizationUnitInput {
  nameFr?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  type?: string;
}

/**
 * Updates a unit and writes the audit row in the same transaction (ADR-022).
 * Authorization is checked against the *target* unit, so a manager cannot update a
 * sibling structure by guessing its id.
 */
export async function updateOrganizationUnit(
  user: AuthenticatedUser,
  id: string,
  input: UpdateOrganizationUnitInput,
  context: { ip: string | null; userAgent: string | null },
): Promise<OrganizationUnitRecord> {
  assertCan(user, 'update', 'organization_unit', { organizationUnitId: id });

  return prisma.$transaction(async (tx) => {
    const before = await tx.organizationUnit.findUniqueOrThrow({ where: { id } });
    const after = await tx.organizationUnit.update({ where: { id }, data: input });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorLabel: `${user.displayName} <${user.email}>`,
        action: 'entity.updated',
        entityType: 'organization_unit',
        entityId: id,
        before: JSON.parse(JSON.stringify(before)) as object,
        after: JSON.parse(JSON.stringify(after)) as object,
        ip: context.ip,
        userAgent: context.userAgent,
      },
    });

    return {
      id: after.id,
      code: after.code,
      nameFr: after.nameFr,
      nameAr: after.nameAr,
      nameEn: after.nameEn,
      type: after.type,
      parentId: after.parentId,
      archivedAt: after.archivedAt,
    };
  });
}
