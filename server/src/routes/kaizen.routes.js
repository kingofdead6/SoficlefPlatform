import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope, canAnyScope } from '../domain/auth/authorization.js';
import { KAIZEN_STATUSES } from '../domain/kaizen/status.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * The Kaizen programme (CDC v1 §3.5) — ported from SoficlefPlatform's
 * app/[locale]/(app)/kaizen/page.tsx and app/actions/kaizen.ts.
 *
 * The whole tree (programme -> missions -> results/journal/gaps/actions) is shared
 * reference content with no per-unit anchor, so reads are gated with
 * `assertCanAnyScope(user, 'read', 'kaizen_action')` rather than a scope filter — there is
 * nothing here to narrow by organization unit.
 */

const router = Router();
router.use(requireAuth);

router.get('/programme', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'kaizen_action');

    const programme = await prisma.kaizenProgramme.findFirst({
      orderBy: { createdAt: 'asc' },
      include: {
        priorityActionsJ30: { orderBy: { order: 'asc' } },
        missions: {
          orderBy: { number: 'asc' },
          include: {
            results: { orderBy: { order: 'asc' } },
            journal: { orderBy: { order: 'asc' } },
            gaps: { orderBy: { order: 'asc' } },
            actions: { orderBy: { order: 'asc' } },
          },
        },
      },
    });

    res.json({ data: programme, mayEdit: canAnyScope(req.user, 'update', 'kaizen_action') });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/** KAIZEN_STATUSES exposed so the client doesn't have to hardcode the enum. */
router.get('/statuses', (req, res) => {
  res.json({ data: KAIZEN_STATUSES });
});

const UpdateActionStatus = z.object({
  id: z.string().uuid(),
  statusFr: z.enum(KAIZEN_STATUSES),
});

/**
 * PATCH /api/v1/kaizen/actions/:id/status — ported from setKaizenActionStatus in
 * app/actions/kaizen.ts. The action carries no organization-unit anchor (the programme
 * belongs to the whole Direction de Production), so this is a global-assignment act.
 */
router.patch('/actions/:id/status', async (req, res, next) => {
  try {
    const result = await mutate(
      req,
      { id: req.params.id, statusFr: req.body?.statusFr },
      {
        schema: UpdateActionStatus,
        requires: { resource: 'kaizen_action', action: 'update' },
        run: async (value, context) => {
          const before = await context.tx.kaizenAction.findUnique({ where: { id: value.id } });
          if (!before) throw Object.assign(new Error('unknown action'), { status: 404 });

          const after = await context.tx.kaizenAction.update({
            where: { id: value.id },
            data: { statusFr: value.statusFr },
          });

          await context.audit({
            action: 'entity.updated',
            entityType: 'kaizen_action',
            entityId: after.id,
            before: { statusFr: before.statusFr },
            after: { statusFr: after.statusFr },
          });

          return after;
        },
      },
    );
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

const CreateAction = z.object({
  missionId: z.string().uuid(),
  slug: z.string().trim().min(1),
  actionFr: z.string().trim().min(1),
  ownerFr: z.string().trim().min(1),
  deadlineFr: z.string().trim().min(1),
  statusFr: z.enum(KAIZEN_STATUSES).default('Planifiée'),
  order: z.number().int().default(0),
});

router.post('/actions', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: CreateAction,
      requires: { resource: 'kaizen_action', action: 'create' },
      run: async (value, context) => {
        const created = await context.tx.kaizenAction.create({ data: value });
        await context.audit({
          action: 'entity.created',
          entityType: 'kaizen_action',
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

const DeleteAction = z.object({ id: z.string().uuid() });

router.delete('/actions/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id }, {
      schema: DeleteAction,
      requires: { resource: 'kaizen_action', action: 'update' },
      run: async (value, context) => {
        const existing = await context.tx.kaizenAction.findUnique({ where: { id: value.id } });
        if (!existing) throw Object.assign(new Error('unknown action'), { status: 404 });
        await context.tx.kaizenAction.delete({ where: { id: value.id } });
        await context.audit({
          action: 'entity.deleted',
          entityType: 'kaizen_action',
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
