import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { assertCanAnyScope, scopeFilterFor } from '../domain/auth/authorization.js';
import { loadPositionMatrix, listPositionsWithMatrix, maxCompetencyLevel } from '../application/competency/matrix.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * Competency matrix / gap analysis, plus family/level/competency reference-data CRUD.
 * Ported from SoficlefPlatform src/application/competency/matrix.ts and
 * src/app/actions/competency.ts (recordAssessment lives in assessments.routes.js).
 */

// ---- reads ------------------------------------------------------------------

router.get('/matrix', async (req, res, next) => {
  try {
    const matrix = await loadPositionMatrix(req.user, {
      positionId: req.query.positionId,
      forUserId: req.query.forUserId,
    });
    if (!matrix) return res.status(404).json({ error: 'not-found' });
    res.json({ data: matrix });
  } catch (error) {
    next(error);
  }
});

router.get('/positions', async (req, res, next) => {
  try {
    res.json({ data: await listPositionsWithMatrix(req.user) });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'competency');
    const competencies = await prisma.competency.findMany({
      where: { archivedAt: null },
      orderBy: { nameFr: 'asc' },
      include: { family: true },
    });
    res.json({ data: competencies });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/families', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'competency');
    const families = await prisma.competencyFamily.findMany({
      where: { archivedAt: null },
      orderBy: { order: 'asc' },
    });
    res.json({ data: families });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/levels', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'competency');
    const levels = await prisma.competencyLevel.findMany({ orderBy: { value: 'asc' } });
    res.json({ data: levels });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

// ---- mutations: competency CRUD ---------------------------------------------

const CreateCompetency = z.object({
  code: z.string().trim().max(40).optional().or(z.literal('')),
  nameFr: z.string().trim().min(2).max(160),
  familyId: z.string().uuid().nullable().optional(),
  categoryFr: z.string().trim().max(120).optional().or(z.literal('')),
  descriptionFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateCompetency,
    requires: { resource: 'competency', action: 'create' },
    run: async (value, context) => {
      const created = await context.tx.competency.create({
        data: {
          code: value.code || null,
          nameFr: value.nameFr,
          familyId: value.familyId ?? null,
          categoryFr: value.categoryFr || null,
          descriptionFr: value.descriptionFr || null,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'competency',
        entityId: created.id,
        after: { nameFr: created.nameFr },
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

const UpdateCompetency = z.object({
  id: z.string().uuid(),
  nameFr: z.string().trim().min(2).max(160).optional(),
  familyId: z.string().uuid().nullable().optional(),
  categoryFr: z.string().trim().max(120).nullable().optional(),
  descriptionFr: z.string().trim().max(2000).nullable().optional(),
});

router.patch('/:id', async (req, res) => {
  const result = await mutate(req, { ...req.body, id: req.params.id }, {
    schema: UpdateCompetency,
    requires: { resource: 'competency', action: 'update' },
    run: async (value, context) => {
      const before = await context.tx.competency.findUniqueOrThrow({ where: { id: value.id } });
      const { id, ...data } = value;
      const after = await context.tx.competency.update({ where: { id }, data });

      await context.audit({
        action: 'entity.updated',
        entityType: 'competency',
        entityId: id,
        before: { nameFr: before.nameFr },
        after: { nameFr: after.nameFr },
      });

      return after;
    },
  });

  sendActionResult(res, result);
});

router.delete('/:id', async (req, res) => {
  const result = await mutate(req, { id: req.params.id }, {
    schema: z.object({ id: z.string().uuid() }),
    requires: { resource: 'competency', action: 'delete' },
    run: async (value, context) => {
      const before = await context.tx.competency.update({
        where: { id: value.id },
        data: { archivedAt: new Date() },
      });

      await context.audit({
        action: 'entity.archived',
        entityType: 'competency',
        entityId: value.id,
        before: { archivedAt: null },
        after: { archivedAt: before.archivedAt },
      });

      return { id: value.id };
    },
  });

  sendActionResult(res, result);
});

// ---- mutations: job<->competency links ---------------------------------------

const SetJobCompetency = z.object({
  positionId: z.string().uuid(),
  competencyId: z.string().uuid(),
  requiredLevel: z.coerce.number().int().min(0),
  notesFr: z.string().trim().max(500).optional().or(z.literal('')),
});

router.post('/job-competencies', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: SetJobCompetency,
    requires: { resource: 'competency', action: 'update' },
    run: async (value, context) => {
      const max = await maxCompetencyLevel();
      if (value.requiredLevel > max) {
        throw Object.assign(new Error(`requiredLevel must be between 0 and ${max}`), { status: 409 });
      }

      const saved = await context.tx.jobCompetency.upsert({
        where: { positionId_competencyId: { positionId: value.positionId, competencyId: value.competencyId } },
        create: {
          positionId: value.positionId,
          competencyId: value.competencyId,
          requiredLevel: value.requiredLevel,
          notesFr: value.notesFr || null,
        },
        update: { requiredLevel: value.requiredLevel, notesFr: value.notesFr || null },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'job_competency',
        entityId: `${saved.positionId}:${saved.competencyId}`,
        after: { requiredLevel: saved.requiredLevel },
      });

      return saved;
    },
  });

  sendActionResult(res, result, 201);
});

// ---- mutations: family CRUD ---------------------------------------------------

const CreateFamily = z.object({
  code: z.string().trim().min(1).max(40),
  nameFr: z.string().trim().min(2).max(160),
  descriptionFr: z.string().trim().max(2000).optional().or(z.literal('')),
  order: z.coerce.number().int().default(0),
});

router.post('/families', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateFamily,
    requires: { resource: 'competency', action: 'create' },
    run: async (value, context) => {
      const created = await context.tx.competencyFamily.create({
        data: { code: value.code, nameFr: value.nameFr, descriptionFr: value.descriptionFr || null, order: value.order },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'competency_family',
        entityId: created.id,
        after: { nameFr: created.nameFr },
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

export default router;
