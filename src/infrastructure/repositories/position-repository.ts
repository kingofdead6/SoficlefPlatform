import 'server-only';

import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { hasRole, scopeFilterFor } from '@/domain/auth/authorization';

import { prisma } from '../db/client';
import { SETTING_KEYS, booleanSetting, numberSetting } from '../settings/app-settings';

/**
 * The org chart as posts, and how much of it each person may see.
 *
 * The visibility rule is enforced *in the query* (ADR-021), not by fetching the whole
 * chart and hiding rows. A collaborator asking for the tree gets a query that cannot
 * return their colleague's branch, so there is no surplus for a UI bug to leak.
 */

export interface PositionNode {
  id: string;
  code: string;
  titleFr: string;
  parentPositionId: string | null;
  organizationUnitId: string | null;
  isVacant: boolean;
  /** How the empty seat is advertised ("Poste VACANT", "Poste à pourvoir"). */
  occupancyFr: string | null;
  /** Who currently holds the post, when anyone does. */
  holder: { id: string; displayName: string } | null;
}

interface Row {
  id: string;
  code: string;
  titleFr: string;
  parentPositionId: string | null;
  organizationUnitId: string | null;
  isVacant: boolean;
  occupancyFr: string | null;
  holderId: string | null;
  holderName: string | null;
}

const toNode = (row: Row): PositionNode => ({
  id: row.id,
  code: row.code,
  titleFr: row.titleFr,
  parentPositionId: row.parentPositionId,
  organizationUnitId: row.organizationUnitId,
  isVacant: row.isVacant,
  occupancyFr: row.occupancyFr,
  holder: row.holderId ? { id: row.holderId, displayName: row.holderName ?? '' } : null,
});

/** The post this person currently holds, if any. */
export async function currentPositionIdFor(userId: string): Promise<string | null> {
  const assignment = await prisma.assignment.findFirst({
    where: { userId, endDate: null },
    select: { positionId: true },
  });
  return assignment?.positionId ?? null;
}

/**
 * The slice of the org chart this user may see.
 *
 * Three audiences, and the difference between them is the point of the function:
 *
 *   - HR, and anyone holding a global read, see the whole chart.
 *   - A manager sees their own sub-tree, without depth limit: their perimeter *is* what
 *     hangs beneath them.
 *   - Everybody else sees a window around their own post — a few levels up, a level or
 *     two down, and optionally the peers who share their manager. The depths come from
 *     `AppSetting`, not from constants, because "how much of the chart is public" is a
 *     business decision that will be argued about after go-live.
 *
 * Returns a flat list; the caller builds the tree. A flat list is what the query
 * naturally produces and what a React tree component consumes.
 */
export async function getVisibleTree(user: AuthenticatedUser): Promise<PositionNode[]> {
  const scope = scopeFilterFor(user, 'read', 'organization_unit');
  if (scope.kind === 'none') return [];

  // A global reader, or an HR/admin role: the entire chart.
  if (scope.kind === 'all') {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT p.id, p.code, p."titleFr", p."parentPositionId", p."organizationUnitId",
             p."isVacant", p."occupancyFr",
             u.id AS "holderId", u."displayName" AS "holderName"
      FROM "position" p
      LEFT JOIN assignment a ON a."positionId" = p.id AND a."endDate" IS NULL
      LEFT JOIN "user" u ON u.id = a."userId"
      WHERE p."archivedAt" IS NULL
      ORDER BY p."order", p."titleFr"
    `;
    return rows.map(toNode);
  }

  const anchorId = await currentPositionIdFor(user.id);

  /*
   * An unplaced account has no anchor, so there is no window to draw around it. Returning
   * nothing is right: this is the `PENDING_ASSIGNMENT` state, where the person is meant to
   * see `/pending` and not the chart.
   */
  if (!anchorId) return [];

  // A manager sees everything beneath their own post, however deep.
  if (scope.kind === 'units' && hasRole(user, 'MANAGER')) {
    const rows = await prisma.$queryRaw<Row[]>`
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
             u.id AS "holderId", u."displayName" AS "holderName"
      FROM "position" p
      JOIN subtree ON subtree.id = p.id
      LEFT JOIN assignment a ON a."positionId" = p.id AND a."endDate" IS NULL
      LEFT JOIN "user" u ON u.id = a."userId"
      ORDER BY p."order", p."titleFr"
    `;
    return rows.map(toNode);
  }

  const [up, down, peers] = await Promise.all([
    numberSetting(SETTING_KEYS.orgTreeDepthUp, { max: 12 }),
    numberSetting(SETTING_KEYS.orgTreeDepthDown, { max: 12 }),
    booleanSetting(SETTING_KEYS.orgTreeShowPeers),
  ]);

  /*
   * The window, in one statement so the depth limit is the database's job.
   *
   * `ancestors` walks up while counting, `descendants` walks down the same way, and both
   * stop at their configured depth — an unbounded walk is what makes a "show me the tree"
   * feature quietly return the whole company.
   */
  const rows = await prisma.$queryRaw<Row[]>`
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
           u.id AS "holderId", u."displayName" AS "holderName"
    FROM "position" p
    JOIN visible ON visible.id = p.id
    LEFT JOIN assignment a ON a."positionId" = p.id AND a."endDate" IS NULL
    LEFT JOIN "user" u ON u.id = a."userId"
    ORDER BY p."order", p."titleFr"
  `;
  return rows.map(toNode);
}
