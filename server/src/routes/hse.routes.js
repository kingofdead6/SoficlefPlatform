import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * HSE reference content — ported from app/[locale]/(app)/hse/page.tsx. Same access
 * pattern as QMS: gated on `document:read`/`document:update` since HSE has no permission
 * resource of its own.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'document');

    const hse = await prisma.hse.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { rules: { orderBy: { order: 'asc' } } },
    });

    res.json({ data: hse });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateHse = z.object({
  id: z.string().uuid(),
  siteFr: z.string().trim().min(1).optional(),
  contactFr: z.string().trim().min(1).optional(),
  zonesFr: z.string().trim().min(1).optional(),
  riskAreaFr: z.string().trim().min(1).optional(),
  circulationPlanNoteFr: z.string().trim().min(1).optional(),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: UpdateHse,
      requires: { resource: 'document', action: 'update' },
      run: async (value, context) => {
        const { id, ...data } = value;
        const before = await context.tx.hse.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error('unknown hse'), { status: 404 });
        const after = await context.tx.hse.update({ where: { id }, data });
        await context.audit({
          action: 'entity.updated',
          entityType: 'hse',
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

const CreateRule = z.object({
  hseId: z.string().uuid(),
  slug: z.string().trim().min(1),
  kind: z.enum(['TRAFFIC', 'PPE']),
  textFr: z.string().trim().min(1),
  order: z.number().int().default(0),
});

router.post('/rules', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: CreateRule,
      requires: { resource: 'document', action: 'create' },
      run: async (value, context) => {
        const created = await context.tx.hseRule.create({ data: value });
        await context.audit({
          action: 'entity.created',
          entityType: 'hse_rule',
          entityId: created.id,
          after: created,
        });
        return created;
      },
    });
    sendActionResult(res, result, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
