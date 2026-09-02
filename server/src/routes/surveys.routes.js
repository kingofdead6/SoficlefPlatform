import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { SCORE_MAX, SCORE_MIN, SURVEY_INDICATORS, isOpen } from '../domain/survey/satisfaction.js';
import { loadMyRounds, loadSatisfaction, loadSurveyResults, ensureRoundsFor } from '../application/survey/rounds.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';

const router = Router();
router.use(requireAuth);

/**
 * Satisfaction surveys (rounds + aggregate reports).
 * Ported from SoficlefPlatform src/application/survey/rounds.ts and
 * src/app/actions/survey.ts. `ensureRoundsFor` is re-exported for the assignments flow.
 */

export { ensureRoundsFor };

router.get('/me', async (req, res, next) => {
  try {
    res.json({ data: await loadMyRounds(req.user) });
  } catch (error) {
    next(error);
  }
});

router.get('/satisfaction', async (req, res, next) => {
  try {
    res.json({ data: await loadSatisfaction(req.user) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /surveys/results — the detailed results view behind /app/hr/surveys/results:
 * scores per indicator, per milestone, and the individual responses, narrowable by
 * division (`unitCode`) or manager (`managerId`).
 *
 * The scope predicate lives inside loadSurveyResults (scopeFilterFor on `survey:read`), so
 * the query filters rather than this handler hiding rows afterwards.
 */
router.get('/results', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'survey');

    const data = await loadSurveyResults(req.user, {
      unitCode: req.query.unitCode || undefined,
      managerId: req.query.managerId || undefined,
    });

    res.json({ data });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const SubmitSurvey = z.object({
  roundId: z.string().uuid(),
  scores: z.record(z.enum(SURVEY_INDICATORS), z.coerce.number().int().min(SCORE_MIN).max(SCORE_MAX)),
  commentFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

router.post('/responses', async (req, res) => {
  const result = await mutate(req, { roundId: req.body?.roundId, scores: req.body?.scores ?? {}, commentFr: req.body?.commentFr ?? '' }, {
    schema: SubmitSurvey,
    requires: { resource: 'survey', action: 'update' },
    target: (_value, user) => ({ ownerUserId: user.id }),
    run: async (value, context) => {
      const round = await context.tx.surveyRound.findUnique({
        where: { id: value.roundId },
        select: { id: true, dayOffset: true, dueDate: true, answeredAt: true, instance: { select: { userId: true } } },
      });
      if (!round) throw Object.assign(new Error('unknown round'), { status: 404 });

      if (round.instance.userId !== context.user.id) {
        throw Object.assign(new Error('not your survey'), { status: 403 });
      }

      if (round.answeredAt) {
        throw Object.assign(new Error('Cette enquête a déjà été renseignée.'), { status: 409 });
      }

      if (!isOpen({ ...round, answeredAt: null })) {
        throw Object.assign(new Error("Cette enquête n'est pas encore ouverte."), { status: 409 });
      }

      const entries = Object.entries(value.scores);
      if (entries.length === 0) {
        throw Object.assign(new Error('Répondez à au moins un indicateur.'), { status: 409 });
      }

      for (const [indicator, score] of entries) {
        await context.tx.surveyResponse.upsert({
          where: { roundId_indicator: { roundId: round.id, indicator } },
          create: {
            roundId: round.id,
            userId: context.user.id,
            indicator,
            score,
            commentFr: value.commentFr ? value.commentFr : null,
          },
          update: { score },
        });
      }

      await context.tx.surveyRound.update({ where: { id: round.id }, data: { answeredAt: new Date() } });

      await context.audit({
        action: 'entity.created',
        entityType: 'survey_round',
        entityId: round.id,
        after: { dayOffset: round.dayOffset, indicators: entries.length },
      });

      return { answered: entries.length };
    },
  });

  sendActionResult(res, result, 201);
});

export default router;
