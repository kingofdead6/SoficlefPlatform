import { Router } from 'express';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';

/**
 * Management team + org chart — ported from app/[locale]/(app)/management/page.tsx.
 * Read-only in the source app (no management mutation actions exist there); gated on
 * `organization_unit:read` per the `management` nav item.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'organization_unit');

    const [members, actions, positions] = await Promise.all([
      prisma.managementMember.findMany({ orderBy: { order: 'asc' } }),
      prisma.managementRecommendedAction.findMany({ orderBy: { order: 'asc' } }),
      prisma.position.findMany({
        where: { archivedAt: null },
        orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
        select: {
          id: true,
          titleFr: true,
          parentPositionId: true,
          isVacant: true,
          occupancyFr: true,
          assignments: {
            where: { endDate: null },
            select: { user: { select: { displayName: true } } },
            take: 1,
          },
        },
      }),
    ]);

    const orgChart = positions.map((position) => ({
      id: position.id,
      parentId: position.parentPositionId,
      titleFr: position.titleFr,
      holderFr:
        position.assignments[0]?.user.displayName ?? position.occupancyFr ?? (position.isVacant ? 'Poste vacant' : null),
      isVacant: position.isVacant,
    }));

    res.json({ data: { members, actions, orgChart } });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

export default router;
