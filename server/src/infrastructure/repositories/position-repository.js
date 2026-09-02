import { hasRole, scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../db/client.js';
import { SETTING_KEYS, booleanSetting, numberSetting } from '../settings/app-settings.js';

/**
 * The org chart as posts, and how much of it each person may see.
 * Ported from SoficlefPlatform src/infrastructure/repositories/position-repository.ts.
 *
 * The visibility rule is enforced *in the query*, not by fetching the whole chart and
 * hiding rows.
 */

/**
 * One row of the chart.
 *
 * The holder carries `email`, `phone` and `avatarUrl`, and the node carries its structure's
 * `organizationUnitNameFr`, because §2.1's org-chart card shows photo / name / position /
 * department / e-mail / extension. Those are the same three columns the signed-in directory
 * (/contacts, GET /users) already exposes to every authenticated user, and none of them
 * widens *which* rows come back — the visibility rule below is untouched. `phone` doubles as
 * the extension: the schema has no separate extension column on `user`, only on `contact`.
 */
const toNode = (row) => ({
  id: row.id,
  code: row.code,
  titleFr: row.titleFr,
  parentPositionId: row.parentPositionId,
  organizationUnitId: row.organizationUnitId,
  organizationUnitNameFr: row.unitNameFr ?? null,
  isVacant: row.isVacant,
  occupancyFr: row.occupancyFr,
  holder: row.holderId
    ? {
        id: row.holderId,
        displayName: row.holderName ?? '',
        email: row.holderEmail ?? null,
        phone: row.holderPhone ?? null,
        avatarUrl: row.holderAvatarUrl ?? null,
      }
    : null,
});

/** The post this person currently holds, if any. */
export async function currentPositionIdFor(userId) {
  const assignment = await prisma.assignment.findFirst({
    where: { userId, endDate: null },
    select: { positionId: true },
  });
  return assignment?.positionId ?? null;
}

/**
 * The slice of the org chart this user may see.
 *
 *   - HR, and anyone holding a global read, see the whole chart.
 *   - A manager sees their own sub-tree, without depth limit.
 *   - Everybody else sees a window around their own post, sized by AppSetting.
 *
 * Returns a flat list; the caller builds the tree.
 */
export async function getVisibleTree(user) {
  const scope = scopeFilterFor(user, 'read', 'organization_unit');
  if (scope.kind === 'none') return [];

  if (scope.kind === 'all') {
    const rows = await prisma.$queryRaw`
      SELECT p.id, p.code, p."titleFr", p."parentPositionId", p."organizationUnitId",
             p."isVacant", p."occupancyFr",
             ou."nameFr" AS "unitNameFr",
             u.id AS "holderId", u."displayName" AS "holderName",
             u.email AS "holderEmail", u.phone AS "holderPhone", u."avatarUrl" AS "holderAvatarUrl"
      FROM "position" p
      LEFT JOIN assignment a ON a."positionId" = p.id AND a."endDate" IS NULL
      LEFT JOIN "user" u ON u.id = a."userId"
      LEFT JOIN organization_unit ou ON ou.id = p."organizationUnitId"
      WHERE p."archivedAt" IS NULL
      ORDER BY p."order", p."titleFr"
    `;
    return rows.map(toNode);
  }

  const anchorId = await currentPositionIdFor(user.id);

  /*
   * An unplaced account has no anchor, so there is no window to draw around it. Returning
   * nothing is right: this is the PENDING_ASSIGNMENT state.
   */
  if (!anchorId) return [];

  // A manager sees everything beneath their own post, however deep.
  if (scope.kind === 'units' && hasRole(user, 'MANAGER')) {
    const rows = await prisma.$queryRaw`
      WITH RECURSIVE subtree AS (
        SELECT id FROM "position" WHERE id = ${anchorId}::uuid AND "archivedAt" IS NULL
        UNION ALL
        SELECT child.id
        FROM "position" child
        JOIN subtree ON child."parentPositionId" = subtree.id
        WHERE child."archivedAt" IS NULL
      )
      SELECT p.id, p.code, p."titleFr", p."parentPositionId", p."organizationUnitId",
             p."isVacant", p."occupancyFr",
             ou."nameFr" AS "unitNameFr",
             u.id AS "holderId", u."displayName" AS "holderName",
             u.email AS "holderEmail", u.phone AS "holderPhone", u."avatarUrl" AS "holderAvatarUrl"
      FROM "position" p
      JOIN subtree ON subtree.id = p.id
      LEFT JOIN assignment a ON a."positionId" = p.id AND a."endDate" IS NULL
      LEFT JOIN "user" u ON u.id = a."userId"
      LEFT JOIN organization_unit ou ON ou.id = p."organizationUnitId"
      ORDER BY p."order", p."titleFr"
    `;
    return rows.map(toNode);
  }

  const [up, down, peers] = await Promise.all([
    numberSetting(SETTING_KEYS.orgTreeDepthUp, { max: 12 }),
    numberSetting(SETTING_KEYS.orgTreeDepthDown, { max: 12 }),
    booleanSetting(SETTING_KEYS.orgTreeShowPeers),
  ]);

  const rows = await prisma.$queryRaw`
    WITH RECURSIVE ancestors AS (
      SELECT id, "parentPositionId", 0 AS depth
      FROM "position" WHERE id = ${anchorId}::uuid AND "archivedAt" IS NULL
      UNION ALL
      SELECT parent.id, parent."parentPositionId", ancestors.depth + 1
      FROM "position" parent
      JOIN ancestors ON ancestors."parentPositionId" = parent.id
      WHERE ancestors.depth < ${up} AND parent."archivedAt" IS NULL
    ),
    descendants AS (
      SELECT id, "parentPositionId", 0 AS depth
      FROM "position" WHERE id = ${anchorId}::uuid AND "archivedAt" IS NULL
      UNION ALL
      SELECT child.id, child."parentPositionId", descendants.depth + 1
      FROM "position" child
      JOIN descendants ON child."parentPositionId" = descendants.id
      WHERE descendants.depth < ${down} AND child."archivedAt" IS NULL
    ),
    peers AS (
      SELECT sibling.id
      FROM "position" sibling
      JOIN "position" self ON self.id = ${anchorId}::uuid
      WHERE ${peers}
        AND sibling."archivedAt" IS NULL
        AND sibling."parentPositionId" IS NOT DISTINCT FROM self."parentPositionId"
    ),
    visible AS (
      SELECT id FROM ancestors
      UNION SELECT id FROM descendants
      UNION SELECT id FROM peers
    )
    SELECT p.id, p.code, p."titleFr", p."parentPositionId", p."organizationUnitId",
           p."isVacant", p."occupancyFr",
           ou."nameFr" AS "unitNameFr",
           u.id AS "holderId", u."displayName" AS "holderName",
           u.email AS "holderEmail", u.phone AS "holderPhone", u."avatarUrl" AS "holderAvatarUrl"
    FROM "position" p
    JOIN visible ON visible.id = p.id
    LEFT JOIN assignment a ON a."positionId" = p.id AND a."endDate" IS NULL
    LEFT JOIN "user" u ON u.id = a."userId"
    LEFT JOIN organization_unit ou ON ou.id = p."organizationUnitId"
    ORDER BY p."order", p."titleFr"
  `;
  return rows.map(toNode);
}

const DETAIL_SELECT = {
  id: true,
  code: true,
  titleFr: true,
  missionFr: true,
  organizationUnitId: true,
  parentPositionId: true,
  order: true,
  isVacant: true,
  occupancy: true,
  occupancyFr: true,
  archivedAt: true,
};

/** A single position, narrowed by the caller's organization-unit scope. */
export async function findPositionForUser(user, id) {
  const scope = scopeFilterFor(user, 'read', 'position');
  if (scope.kind === 'none' || scope.kind === 'self') return null;

  return prisma.position.findFirst({
    where: {
      id,
      archivedAt: null,
      ...(scope.kind === 'units' ? { organizationUnitId: { in: scope.organizationUnitIds } } : {}),
    },
    select: DETAIL_SELECT,
  });
}

/** Every non-archived position in the caller's scope, flat (for lists/selects). */
export async function listPositionsForUser(user) {
  const scope = scopeFilterFor(user, 'read', 'position');
  if (scope.kind === 'none' || scope.kind === 'self') return [];

  return prisma.position.findMany({
    where: {
      archivedAt: null,
      ...(scope.kind === 'units' ? { organizationUnitId: { in: scope.organizationUnitIds } } : {}),
    },
    orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
    select: DETAIL_SELECT,
  });
}
