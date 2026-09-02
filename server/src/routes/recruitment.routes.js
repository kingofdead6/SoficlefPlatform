import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * Recruitment — ported from app/[locale]/(app)/recruitment/page.tsx. Gated on `job:read`
 * (see Client/src/lib/navigation.js's `recruitment` nav item); writes use `job:create`/
 * `job:update`, held only by ADMIN.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'job');

    const recruitment = await prisma.recruitment.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { positions: { orderBy: { order: 'asc' } } },
    });

    res.json({ data: recruitment });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateRecruitment = z.object({
  id: z.string().uuid(),
  internalMobilityNoteFr: z.string().trim().min(1).optional(),
  recommendedActionFr: z.string().trim().min(1).optional(),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: UpdateRecruitment,
      requires: { resource: 'job', action: 'update' },
      run: async (value, context) => {
        const { id, ...data } = value;
        const before = await context.tx.recruitment.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error('unknown recruitment'), { status: 404 });
        const after = await context.tx.recruitment.update({ where: { id }, data });
        await context.audit({
          action: 'entity.updated',
          entityType: 'recruitment',
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

const CreatePosition = z.object({
  recruitmentId: z.string().uuid(),
  slug: z.string().trim().min(1),
  titleFr: z.string().trim().min(1),
  attachmentFr: z.string().trim().min(1),
  statusFr: z.string().trim().min(1),
  order: z.number().int().default(0),
});

router.post('/positions', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: CreatePosition,
      requires: { resource: 'job', action: 'create' },
      run: async (value, context) => {
        const created = await context.tx.openPosition.create({ data: value });
        await context.audit({
          action: 'entity.created',
          entityType: 'open_position',
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

const UpdatePosition = z.object({
  id: z.string().uuid(),
  titleFr: z.string().trim().min(1).optional(),
  attachmentFr: z.string().trim().min(1).optional(),
  statusFr: z.string().trim().min(1).optional(),
  order: z.number().int().optional(),
});

router.patch('/positions/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: UpdatePosition,
      requires: { resource: 'job', action: 'update' },
      run: async (value, context) => {
        const { id, ...data } = value;
        const before = await context.tx.openPosition.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error('unknown position'), { status: 404 });
        const after = await context.tx.openPosition.update({ where: { id }, data });
        await context.audit({
          action: 'entity.updated',
          entityType: 'open_position',
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

router.delete('/positions/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id }, {
      schema: z.object({ id: z.string().uuid() }),
      requires: { resource: 'job', action: 'delete' },
      run: async (value, context) => {
        const existing = await context.tx.openPosition.findUnique({ where: { id: value.id } });
        if (!existing) throw Object.assign(new Error('unknown position'), { status: 404 });
        await context.tx.openPosition.delete({ where: { id: value.id } });
        await context.audit({
          action: 'entity.deleted',
          entityType: 'open_position',
          entityId: value.id,
          before: existing,
        });
        return { id: value.id };
      },
    });
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
