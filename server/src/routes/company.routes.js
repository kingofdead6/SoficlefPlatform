import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * Company presentation — ported from app/[locale]/(app)/company/page.tsx. Static
 * reference content, gated on `dashboard:read` (see the `company` nav item); writes use
 * `setting:update`, held only by ADMIN.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'dashboard');

    const company = await prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { activities: { orderBy: { order: 'asc' } } },
    });
    if (!company) return res.json({ data: null });

    const values = await prisma.companyValue.findMany({ orderBy: { rank: 'asc' } });

    res.json({ data: { ...company, values } });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateCompany = z.object({
  id: z.string().uuid(),
  legalName: z.string().trim().min(1).optional(),
  legalForm: z.string().trim().min(1).optional(),
  foundedYear: z.number().int().optional(),
  foundedCity: z.string().trim().min(1).optional(),
  headquarters: z.string().trim().min(1).optional(),
  generalManager: z.string().trim().min(1).optional(),
  certification: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  website: z.string().trim().min(1).optional(),
  visionFr: z.string().trim().min(1).optional(),
  missionFr: z.string().trim().min(1).optional(),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: UpdateCompany,
      requires: { resource: 'setting', action: 'update' },
      run: async (value, context) => {
        const { id, ...data } = value;
        const before = await context.tx.company.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error('unknown company'), { status: 404 });
        const after = await context.tx.company.update({ where: { id }, data });
        await context.audit({
          action: 'entity.updated',
          entityType: 'company',
          entityId: id,
          before,
          after,
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
