import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * SMQ / ISO 9001 reference content — ported from app/[locale]/(app)/qms/page.tsx.
 * Gated on `document:read` (see Client/src/lib/navigation.js's `qms` nav item), since QMS
 * has no permission resource of its own in the source app's permission table. Writes use
 * `document:update`/`document:create`, held only by ADMIN.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'document');

    const qms = await prisma.qms.findFirst({
      orderBy: { createdAt: 'asc' },
      include: {
        responsibilities: { orderBy: { order: 'asc' } },
        processes: { orderBy: { order: 'asc' } },
      },
    });

    res.json({ data: qms });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateQms = z.object({
  id: z.string().uuid(),
  standardFr: z.string().trim().min(1).optional(),
  certificationBodyFr: z.string().trim().min(1).optional(),
  certifiedSinceFr: z.string().trim().min(1).optional(),
  certificationScopeFr: z.string().trim().min(1).optional(),
  ownedProcessCode: z.string().trim().min(1).optional(),
  ownedProcessNoteFr: z.string().trim().min(1).optional(),
  processMapCode: z.string().trim().min(1).optional(),
});

router.patch('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: UpdateQms,
      requires: { resource: 'document', action: 'update' },
      run: async (value, context) => {
        const { id, ...data } = value;
        const before = await context.tx.qms.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error('unknown qms'), { status: 404 });
        const after = await context.tx.qms.update({ where: { id }, data });
        await context.audit({
          action: 'entity.updated',
          entityType: 'qms',
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

const CreateProcess = z.object({
  qmsId: z.string().uuid(),
  code: z.string().trim().min(1),
  category: z.enum(['MANAGEMENT', 'REALISATION', 'SUPPORT']),
  categoryLabelFr: z.string().trim().min(1),
  nameFr: z.string().trim().min(1),
  isOwnedByProductionDirector: z.boolean().default(false),
  order: z.number().int().default(0),
});

router.post('/processes', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: CreateProcess,
      requires: { resource: 'document', action: 'create' },
      run: async (value, context) => {
        const created = await context.tx.qmsProcess.create({ data: value });
        await context.audit({
          action: 'entity.created',
          entityType: 'qms_process',
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
