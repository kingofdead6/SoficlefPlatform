import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { canAnyScope, assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { audit } from '../infrastructure/repositories/audit-repository.js';

/**
 * Quests — an ad-hoc task a manager assigns to any direct report, independent of onboarding.
 * See prisma/migrations/20260906090000_manager_quests for why this is a separate table from
 * manager_task rather than an extension of it.
 *
 * Two views on the same table, not two endpoints: GET / returns quests the caller assigned
 * (MANAGER) union quests assigned to the caller (EMPLOYEE) — a manager who is also someone
 * else's report sees both halves, same as every other dual-role account in this app.
 *
 * Only the assignee may change status. A manager can edit or delete the quest itself, but
 * cannot mark it done on the assignee's behalf — the whole point of a quest is the report's
 * own signal that it is finished, not the manager's record of having assigned it.
 *
 * This router does NOT use mutate()/can()'s scope machinery. scopeCovers() only recognises
 * ORGANIZATION_UNIT and SELF scope kinds, and a MANAGER's real-world grant here is
 * ORGANIZATION_UNIT-scoped — so a target shaped as { ownerUserId } is silently rejected no
 * matter who it names, because the ORGANIZATION_UNIT branch checks only organizationUnitId
 * and never looks at ownerUserId. "Is this person actually my direct report" is not an
 * org-unit fact anyway (a report's position may sit in a unit outside the manager's own
 * scope), so every route below does a coarse assertCanAnyScope (does the caller hold this
 * permission at all) followed by an explicit check against User.managerId / quest.assigneeId
 * / quest.createdById — the same two-step remarks.routes.js uses for its own delete route.
 */

const router = Router();
router.use(requireAuth);

const questSelect = {
  id: true,
  titleFr: true,
  detailFr: true,
  dueDate: true,
  status: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignee: { select: { id: true, displayName: true, avatarUrl: true } },
  createdBy: { select: { id: true, displayName: true } },
};

function ipFrom(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? null;
}

/** GET /assignable — the caller's own direct reports, for the "assign to" picker. */
router.get('/assignable', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'create', 'quest');
    const reports = await prisma.user.findMany({
      where: { managerId: req.user.id, status: 'ACTIVE' },
      select: { id: true, displayName: true, avatarUrl: true, positionTitleFr: true },
      orderBy: { displayName: 'asc' },
    });
    res.json({ data: reports });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    const canAssign = canAnyScope(user, 'create', 'quest');
    const canRead = canAnyScope(user, 'read', 'quest');
    if (!canAssign && !canRead) return res.status(403).json({ error: 'forbidden' });

    const quests = await prisma.quest.findMany({
      where: {
        OR: [...(canAssign ? [{ createdById: user.id }] : []), ...(canRead ? [{ assigneeId: user.id }] : [])],
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      select: questSelect,
    });

    res.json({ data: quests });
  } catch (error) {
    next(error);
  }
});

const CreateQuest = z.object({
  assigneeId: z.string().uuid(),
  titleFr: z.string().trim().min(2).max(160),
  detailFr: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

router.post('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'create', 'quest');

    const parsed = CreateQuest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'invalid', fieldErrors: parsed.error.flatten().fieldErrors });
    }
    const input = parsed.data;

    const assignee = await prisma.user.findUnique({ where: { id: input.assigneeId }, select: { managerId: true } });
    if (!assignee) return res.status(404).json({ error: 'not-found' });
    if (assignee.managerId !== req.user.id) return res.status(403).json({ error: 'forbidden' });

    const created = await prisma.$transaction(async (tx) => {
      const quest = await tx.quest.create({
        data: {
          assigneeId: input.assigneeId,
          createdById: req.user.id,
          titleFr: input.titleFr,
          detailFr: input.detailFr ?? null,
          dueDate: input.dueDate ?? null,
        },
        select: questSelect,
      });

      await audit({
        actorId: req.user.id,
        actorLabel: req.user.displayName,
        action: 'entity.created',
        entityType: 'quest',
        entityId: quest.id,
        before: null,
        after: { assigneeId: input.assigneeId, titleFr: input.titleFr },
        ip: ipFrom(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      return quest;
    });

    res.status(201).json({ data: created });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const UpdateQuestStatus = z.object({ status: z.enum(['TODO', 'DONE']) });

/** PATCH /:id/status — the assignee marking their own quest done or reopening it. */
router.patch('/:id/status', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'update', 'quest');

    const id = z.string().uuid().parse(req.params.id);
    const parsed = UpdateQuestStatus.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'invalid', fieldErrors: parsed.error.flatten().fieldErrors });
    }

    const existing = await prisma.quest.findUnique({ where: { id }, select: { assigneeId: true, status: true } });
    if (!existing) return res.status(404).json({ error: 'not-found' });
    if (existing.assigneeId !== req.user.id) return res.status(403).json({ error: 'forbidden' });

    const updated = await prisma.$transaction(async (tx) => {
      const quest = await tx.quest.update({
        where: { id },
        data: {
          status: parsed.data.status,
          completedAt: parsed.data.status === 'DONE' ? new Date() : null,
        },
        select: questSelect,
      });

      await audit({
        actorId: req.user.id,
        actorLabel: req.user.displayName,
        action: 'entity.updated',
        entityType: 'quest',
        entityId: id,
        before: { status: existing.status },
        after: { status: parsed.data.status },
        ip: ipFrom(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      return quest;
    });

    res.json({ data: updated });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const EditQuest = z.object({
  titleFr: z.string().trim().min(2).max(160),
  detailFr: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

/** PUT /:id — the manager who created the quest editing its details. */
router.put('/:id', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'create', 'quest');

    const id = z.string().uuid().parse(req.params.id);
    const parsed = EditQuest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'invalid', fieldErrors: parsed.error.flatten().fieldErrors });
    }

    const existing = await prisma.quest.findUnique({ where: { id }, select: { createdById: true, titleFr: true } });
    if (!existing) return res.status(404).json({ error: 'not-found' });
    if (existing.createdById !== req.user.id) return res.status(403).json({ error: 'forbidden' });

    const input = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      const quest = await tx.quest.update({
        where: { id },
        data: {
          titleFr: input.titleFr,
          detailFr: input.detailFr ?? null,
          dueDate: input.dueDate ?? null,
        },
        select: questSelect,
      });

      await audit({
        actorId: req.user.id,
        actorLabel: req.user.displayName,
        action: 'entity.updated',
        entityType: 'quest',
        entityId: id,
        before: { titleFr: existing.titleFr },
        after: { titleFr: input.titleFr },
        ip: ipFrom(req),
        userAgent: req.headers['user-agent'] ?? null,
      });

      return quest;
    });

    res.json({ data: updated });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'create', 'quest');

    const id = z.string().uuid().parse(req.params.id);
    const quest = await prisma.quest.findUnique({ where: { id }, select: { createdById: true } });
    if (!quest) return res.status(404).json({ error: 'not-found' });
    if (quest.createdById !== req.user.id) return res.status(403).json({ error: 'forbidden' });

    await prisma.quest.delete({ where: { id } });
    await audit({
      actorId: req.user.id,
      actorLabel: req.user.displayName,
      action: 'entity.deleted',
      entityType: 'quest',
      entityId: id,
      before: { createdById: quest.createdById },
      after: null,
      ip: ipFrom(req),
      userAgent: req.headers['user-agent'] ?? null,
    });

    res.json({ ok: true });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

export default router;
