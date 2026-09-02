import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * Strategic plan — ported from app/[locale]/(app)/strategy/page.tsx. Gated on
 * `dashboard:read` (see the `strategy` nav item); writes use `setting:update`, ADMIN-only.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'dashboard');

    const strategy = await prisma.strategy.findFirst({
      orderBy: { createdAt: 'asc' },
      include: {
        markets: { orderBy: { order: 'asc' } },
        projects: { orderBy: { order: 'asc' } },
        contributions: { orderBy: { order: 'asc' } },
      },
    });

    res.json({ data: strategy });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateContribution = z.object({
  id: z.string().uuid(),
  progressPercent: z.number().int().min(0).max(100),
});

/** The one field a program office would actually update from this screen: progress. */
router.patch('/contributions/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, progressPercent: req.body?.progressPercent }, {
      schema: UpdateContribution,
      requires: { resource: 'setting', action: 'update' },
      run: async (value, context) => {
        const before = await context.tx.strategyContribution.findUnique({ where: { id: value.id } });
        if (!before) throw Object.assign(new Error('unknown contribution'), { status: 404 });
        const after = await context.tx.strategyContribution.update({
          where: { id: value.id },
          data: { progressPercent: value.progressPercent },
        });
        await context.audit({
          action: 'entity.updated',
          entityType: 'strategy_contribution',
          entityId: value.id,
          before: { progressPercent: before.progressPercent },
          after: { progressPercent: after.progressPercent },
        });
        return after;
      },
    });
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
