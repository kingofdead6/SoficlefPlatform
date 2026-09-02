import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { scopeFilterFor } from '../domain/auth/authorization.js';
import { maxCompetencyLevel } from '../application/competency/matrix.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * Assessment CRUD (a manager/self rating of a person's competency level).
 * Ported from SoficlefPlatform src/app/actions/competency.ts (recordAssessment).
 * Assessments are append-only — recording a new one never updates a prior row, so the
 * progression history that feeds the gap chart over time survives (CDC v0.1 §16.1).
 */

router.get('/', async (req, res, next) => {
  try {
    const scope = scopeFilterFor(req.user, 'read', 'assessment');
    if (scope.kind === 'none') return res.json({ data: [] });

    const subjectUserId = req.query.userId;
    const where =
      scope.kind === 'self'
        ? { userId: req.user.id }
        : scope.kind === 'units'
          ? {
              user: {
                userRoles: { some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } } },
              },
            }
          : {};

    const assessments = await prisma.assessment.findMany({
      where: { ...where, ...(subjectUserId ? { userId: subjectUserId } : {}) },
      orderBy: { assessedAt: 'desc' },
      include: { competency: { select: { nameFr: true, code: true } } },
    });
    res.json({ data: assessments });
  } catch (error) {
    next(error);
  }
});

const RecordAssessment = z.object({
  competencyId: z.string().uuid(),
  subjectUserId: z.string().uuid(),
  level: z.coerce.number().int().min(0),
  notesFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: RecordAssessment,
    requires: { resource: 'assessment', action: 'assess' },
    target: async (value) => {
      const subject = await prisma.user.findUnique({
        where: { id: value.subjectUserId },
        select: { id: true, userRoles: { select: { scope: { select: { organizationUnitId: true } } } } },
      });
      if (!subject) throw Object.assign(new Error('unknown subject'), { status: 404 });

      return {
        ownerUserId: subject.id,
        organizationUnitId: subject.userRoles.map((role) => role.scope?.organizationUnitId).find(Boolean) ?? null,
      };
    },
    run: async (value, context) => {
      const max = await maxCompetencyLevel();
      if (value.level > max) {
        throw Object.assign(new Error(`level must be between 0 and ${max}`), { status: 409 });
      }

      const created = await context.tx.assessment.create({
        data: {
          competencyId: value.competencyId,
          userId: value.subjectUserId,
          level: value.level,
          assessedBy: context.user.id,
          notesFr: value.notesFr ? value.notesFr : null,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'assessment',
        entityId: created.id,
        after: { competencyId: created.competencyId, userId: created.userId, level: created.level },
      });

      return { level: created.level, id: created.id };
    },
  });

  sendActionResult(res, result, 201);
});

export default router;
