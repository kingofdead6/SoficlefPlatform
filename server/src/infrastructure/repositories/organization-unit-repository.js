import { assertCan, scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../db/client.js';

/**
 * Organization units — the scope anchor. Every read takes the acting user and narrows
 * the query itself, so no endpoint can over-fetch and rely on the UI to hide the surplus.
 */

const SELECT = {
  id: true,
  code: true,
  nameFr: true,
  nameAr: true,
  nameEn: true,
  type: true,
  parentId: true,
  archivedAt: true,
};

/** A unit and every unit beneath it, resolved with a recursive CTE. */
export async function descendantUnitIds(rootIds) {
  if (rootIds.length === 0) return [];
  const rows = await prisma.$queryRaw`
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

export async function listOrganizationUnits(user) {
  const filter = scopeFilterFor(user, 'read', 'organization_unit');
  if (filter.kind === 'none') return [];

  const where =
    filter.kind === 'units'
      ? { id: { in: filter.organizationUnitIds }, archivedAt: null }
      : filter.kind === 'self'
        ? { id: { in: [] } }
        : { archivedAt: null };

  return prisma.organizationUnit.findMany({
    where,
    orderBy: { code: 'asc' },
    select: SELECT,
  });
}

export async function findOrganizationUnitForUser(user, id) {
  const filter = scopeFilterFor(user, 'read', 'organization_unit');
  if (filter.kind === 'none' || filter.kind === 'self') return null;
  if (filter.kind === 'units' && !filter.organizationUnitIds.includes(id)) return null;

  return prisma.organizationUnit.findFirst({
    where: { id, archivedAt: null },
    select: SELECT,
  });
}

export async function updateOrganizationUnit(user, id, input, context) {
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
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(after)),
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
