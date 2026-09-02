import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * The alerts rules engine (route guide §2.3, /app/hr/alerts): who is reminded, after how
 * long, and where it escalates.
 *
 * There is no `alert:*` resource in the permission catalogue and inventing one would mean
 * editing domain/auth/permissions.js — a change to the platform's authorization vocabulary
 * for one screen. Instead the endpoints are gated on permissions HR already holds and that
 * mean the right thing: `dashboard:read` for seeing the rules (this is pilotage
 * configuration), `survey:update` for changing them (the reminder policy governs the survey
 * and task chase-up that HR owns). ADMIN holds `dashboard:read` but not `survey:update`, so
 * ADMIN reads the rules without editing them — an acceptable consequence, since the reminder
 * policy is HR's to set.
 */

const TRIGGERS = ['TASK_OVERDUE', 'SURVEY_UNANSWERED', 'EVALUATION_DUE'];
const DEPARTMENTS = ['HR', 'IT', 'HSE', 'QUALITY', 'MANAGER', 'EMPLOYEE'];

router.get('/rules', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'dashboard');

    const rules = await prisma.alertRule.findMany({
      orderBy: [{ isActive: 'desc' }, { trigger: 'asc' }, { thresholdDays: 'asc' }],
    });

    res.json({ data: rules, triggers: TRIGGERS, departments: DEPARTMENTS });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const RuleShape = {
  labelFr: z.string().trim().min(2).max(160),
  trigger: z.enum(TRIGGERS),
  thresholdDays: z.coerce.number().int().min(0).max(365),
  notifyDepartment: z.enum(DEPARTMENTS),
  escalateAfterDays: z.coerce.number().int().min(1).max(365).nullable().optional(),
  isActive: z.coerce.boolean().default(true),
};

const CreateRule = z.object(RuleShape);

router.post('/rules', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateRule,
    requires: { resource: 'survey', action: 'update' },
    run: async (value, context) => {
      const created = await context.tx.alertRule.create({
        data: {
          labelFr: value.labelFr,
          trigger: value.trigger,
          thresholdDays: value.thresholdDays,
          notifyDepartment: value.notifyDepartment,
          escalateAfterDays: value.escalateAfterDays ?? null,
          isActive: value.isActive,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'alert_rule',
        entityId: created.id,
        after: { labelFr: created.labelFr, trigger: created.trigger, thresholdDays: created.thresholdDays },
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

const UpdateRule = z.object({
  labelFr: RuleShape.labelFr.optional(),
  trigger: RuleShape.trigger.optional(),
  thresholdDays: RuleShape.thresholdDays.optional(),
  notifyDepartment: RuleShape.notifyDepartment.optional(),
  escalateAfterDays: RuleShape.escalateAfterDays,
  isActive: z.coerce.boolean().optional(),
});

router.patch('/rules/:id', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: UpdateRule,
    requires: { resource: 'survey', action: 'update' },
    run: async (value, context) => {
      const before = await context.tx.alertRule.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown rule'), { status: 404 });

      const after = await context.tx.alertRule.update({
        where: { id: req.params.id },
        data: {
          ...(value.labelFr !== undefined ? { labelFr: value.labelFr } : {}),
          ...(value.trigger !== undefined ? { trigger: value.trigger } : {}),
          ...(value.thresholdDays !== undefined ? { thresholdDays: value.thresholdDays } : {}),
          ...(value.notifyDepartment !== undefined ? { notifyDepartment: value.notifyDepartment } : {}),
          ...(value.escalateAfterDays !== undefined ? { escalateAfterDays: value.escalateAfterDays } : {}),
          ...(value.isActive !== undefined ? { isActive: value.isActive } : {}),
        },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'alert_rule',
        entityId: after.id,
        before,
        after,
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

router.delete('/rules/:id', async (req, res) => {
  const result = await mutate(req, {}, {
    schema: z.object({}),
    requires: { resource: 'survey', action: 'update' },
    run: async (_value, context) => {
      const before = await context.tx.alertRule.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown rule'), { status: 404 });

      await context.tx.alertRule.delete({ where: { id: req.params.id } });

      await context.audit({
        action: 'entity.deleted',
        entityType: 'alert_rule',
        entityId: before.id,
        before,
        after: null,
      });

      return { id: before.id };
    },
  });

  sendActionResult(res, result);
});

export default router;
