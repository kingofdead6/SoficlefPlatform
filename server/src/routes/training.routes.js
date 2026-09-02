import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { grade } from '../domain/training/quiz.js';
import { loadCatalogue, loadModule, loadTrainingCoverage } from '../application/training/catalogue.js';

const router = Router();
router.use(requireAuth);

/**
 * Training catalogue + quiz submission. `correctOption` is never selected/returned to the
 * browser outside grading — loadModule/toPublicQuestions strip it before this file ever
 * sees it in a response body.
 * Ported from SoficlefPlatform src/application/training/catalogue.ts and
 * src/app/actions/training.ts.
 */

router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await loadCatalogue(req.user) });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/coverage', async (req, res, next) => {
  try {
    res.json({ data: await loadTrainingCoverage(req.user) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /training/certificates/me — backs /app/me/training/certificates (route guide §2.1).
 *
 * A certificate here is a passed attempt whose `certifiedAt` is set — the training route's
 * own submission handler sets it exactly once per module, on the first pass, so this list is
 * one row per certified module rather than one per retry. Scoped to `context.user.id`
 * unconditionally: there is no parameter that could name another person's record.
 *
 * Declared above `GET /:code` so "certificates" is not read as a module code.
 */
router.get('/certificates/me', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'training');

    const attempts = await prisma.trainingAttempt.findMany({
      where: { userId: req.user.id, passed: true, certifiedAt: { not: null } },
      orderBy: { certifiedAt: 'desc' },
      select: {
        id: true,
        score: true,
        certifiedAt: true,
        completedAt: true,
        module: { select: { id: true, code: true, titleFr: true, isMandatory: true, passingScore: true } },
      },
    });

    res.json({
      data: attempts.map((attempt) => ({
        id: attempt.id,
        score: attempt.score,
        certifiedAt: attempt.certifiedAt,
        completedAt: attempt.completedAt,
        moduleId: attempt.module.id,
        moduleCode: attempt.module.code,
        moduleTitleFr: attempt.module.titleFr,
        isMandatory: attempt.module.isMandatory,
        passingScore: attempt.module.passingScore,
      })),
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const mod = await loadModule(req.user, req.params.code);
    if (!mod) return res.status(404).json({ error: 'not-found' });
    res.json({ data: mod });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const SubmitQuiz = z.object({
  moduleId: z.string().uuid(),
  answers: z.record(z.string().uuid(), z.string().min(1).max(64)),
});

router.post('/:moduleId/attempts', async (req, res) => {
  const result = await mutate(req, { moduleId: req.params.moduleId, answers: req.body?.answers ?? {} }, {
    schema: SubmitQuiz,
    requires: { resource: 'training', action: 'update' },
    target: (_value, user) => ({ ownerUserId: user.id }),
    run: async (value, context) => {
      const trainingModule = await context.tx.trainingModule.findUnique({
        where: { id: value.moduleId },
        select: {
          id: true,
          passingScore: true,
          archivedAt: true,
          questions: { select: { id: true, correctOption: true } },
        },
      });
      if (!trainingModule || trainingModule.archivedAt) {
        throw Object.assign(new Error('unknown module'), { status: 404 });
      }
      if (trainingModule.questions.length === 0) {
        throw Object.assign(new Error('Ce module ne comporte pas encore de questions.'), { status: 409 });
      }

      const outcome = grade(trainingModule.questions, value.answers, trainingModule.passingScore);

      const alreadyCertified = await context.tx.trainingAttempt.findFirst({
        where: { moduleId: trainingModule.id, userId: context.user.id, certifiedAt: { not: null } },
        select: { id: true },
      });

      const now = new Date();
      const attempt = await context.tx.trainingAttempt.create({
        data: {
          moduleId: trainingModule.id,
          userId: context.user.id,
          score: outcome.score,
          passed: outcome.passed,
          answers: value.answers,
          completedAt: now,
          certifiedAt: outcome.passed && !alreadyCertified ? now : null,
        },
      });

      await context.audit({
        action: outcome.passed ? 'entity.validated' : 'entity.created',
        entityType: 'training_attempt',
        entityId: attempt.id,
        after: { moduleId: trainingModule.id, score: outcome.score, passed: outcome.passed },
      });

      return {
        score: outcome.score,
        passed: outcome.passed,
        correct: outcome.correct,
        total: outcome.total,
        certified: attempt.certifiedAt !== null,
      };
    },
  });

  sendActionResult(res, result, 201);
});

// ---- mutations: module CRUD (ADMIN/HR) ---------------------------------------

const CreateModule = z.object({
  code: z.string().trim().min(1).max(40),
  titleFr: z.string().trim().min(2).max(200),
  summaryFr: z.string().trim().max(2000),
  contentFr: z.string().trim().max(20000),
  isMandatory: z.coerce.boolean().default(true),
  passingScore: z.coerce.number().int().min(0).max(100).default(70),
  order: z.coerce.number().int().default(0),
});

router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateModule,
    requires: { resource: 'training', action: 'create' },
    run: async (value, context) => {
      const created = await context.tx.trainingModule.create({ data: { ...value, isPlaceholder: false } });

      await context.audit({
        action: 'entity.created',
        entityType: 'training_module',
        entityId: created.id,
        after: { code: created.code, titleFr: created.titleFr },
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

const CreateQuestion = z.object({
  moduleId: z.string().uuid(),
  order: z.coerce.number().int(),
  promptFr: z.string().trim().min(2).max(2000),
  options: z.array(z.object({ id: z.string().min(1).max(64), labelFr: z.string().min(1).max(500) })).min(2),
  correctOption: z.string().min(1).max(64),
  explanationFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

router.post('/:moduleId/questions', async (req, res) => {
  const result = await mutate(req, { ...req.body, moduleId: req.params.moduleId }, {
    schema: CreateQuestion,
    requires: { resource: 'training', action: 'update' },
    run: async (value, context) => {
      const created = await context.tx.trainingQuestion.create({
        data: {
          moduleId: value.moduleId,
          order: value.order,
          promptFr: value.promptFr,
          options: value.options,
          correctOption: value.correctOption,
          explanationFr: value.explanationFr || null,
        },
        select: { id: true, moduleId: true, order: true },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'training_question',
        entityId: created.id,
        after: { moduleId: created.moduleId, order: created.order },
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

export default router;
