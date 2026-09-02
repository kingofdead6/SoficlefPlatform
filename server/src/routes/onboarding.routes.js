import { createHash } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { ForbiddenError, assertCanAnyScope, scopeFilterFor } from '../domain/auth/authorization.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { anchorOfInstance, loadJourney, loadJourneySummaries } from '../application/onboarding/journey.js';
import { loadTaskComments, loadTaskDetail } from '../application/me/task-detail.js';
import { loadMeOverview } from '../application/me/overview.js';
import { listRecruits, loadRecruit, alertsFor } from '../application/manager/team.js';
import { assertTransition, isCompleted, requiredActionFor } from '../domain/onboarding/task.js';
import {
  DECIDABLE_OUTCOMES,
  outcomeOfRecommendation,
  scorePercent,
  scoreTotal,
  suggestedOutcome,
  THRESHOLDS,
} from '../domain/onboarding/probation.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * Onboarding journey / me overview / manager recruits & evaluations & manager tasks.
 * Ported from SoficlefPlatform src/application/onboarding/journey.ts,
 * src/application/me/{overview,task-detail}.ts, src/application/manager/team.ts,
 * and mutation logic from src/app/actions/{onboarding,evaluations}.ts.
 */

// ---- reads ----------------------------------------------------------------

router.get('/me/overview', async (req, res, next) => {
  try {
    res.json({ data: await loadMeOverview(req.user) });
  } catch (error) {
    next(error);
  }
});

router.get('/journey', async (req, res, next) => {
  try {
    const journey = await loadJourney(req.user, {
      subjectUserId: req.query.subjectUserId,
      instanceId: req.query.instanceId,
    });
    if (!journey) return res.status(404).json({ error: 'not-found' });
    res.json({ data: journey });
  } catch (error) {
    next(error);
  }
});

router.get('/journey/summaries', async (req, res, next) => {
  try {
    res.json({ data: await loadJourneySummaries(req.user) });
  } catch (error) {
    next(error);
  }
});

router.get('/journey/tasks/:milestoneId', async (req, res, next) => {
  try {
    const detail = await loadTaskDetail(req.user, req.params.milestoneId);
    if (!detail) return res.status(404).json({ error: 'not-found' });
    res.json({ data: detail });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /journey/tasks/:milestoneId/comments — the thread of one task.
 *
 * loadTaskDetail is the ownership check: it resolves the task through loadJourney, which is
 * scoped by `scopeFilterFor(user, 'read', 'onboarding_task')`. A milestone the caller's own
 * journey does not contain is 404, never found-then-refused. The page itself does not need
 * this endpoint — loadTaskDetail already returns `comments` — but posting a comment refreshes
 * just the thread rather than the whole task.
 */
router.get('/journey/tasks/:milestoneId/comments', async (req, res, next) => {
  try {
    const detail = await loadTaskDetail(req.user, req.params.milestoneId);
    if (!detail) return res.status(404).json({ error: 'not-found' });
    res.json({ data: detail.comments });
  } catch (error) {
    next(error);
  }
});

router.get('/manager/recruits', async (req, res, next) => {
  try {
    const recruits = await listRecruits(req.user, { includeArchived: req.query.includeArchived === 'true' });
    res.json({ data: recruits, alerts: alertsFor(recruits) });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /onboarding/manager/dashboard — backs /app/manager: a card per recruit with %
 * progress and status colour, the alert panel (overdue tasks, blockages, upcoming
 * D+30/D+90 interviews), and the manager's own pending managerial tasks. Reuses
 * listRecruits/alertsFor (Section 2.2 of the route guide) rather than a new query.
 */
router.get('/manager/dashboard', async (req, res, next) => {
  try {
    const recruits = await listRecruits(req.user, { includeArchived: false });
    const alerts = alertsFor(recruits);

    const ownTasks = await prisma.managerTask.findMany({
      where: { createdById: req.user.id, status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        titleFr: true,
        dueDate: true,
        status: true,
        ownerDepartment: true,
        instance: { select: { id: true, user: { select: { id: true, displayName: true } } } },
      },
    });

    res.json({ data: { recruits, alerts, ownTasks } });
  } catch (error) {
    next(error);
  }
});

router.get('/manager/recruits/:userId', async (req, res, next) => {
  try {
    const recruit = await loadRecruit(req.user, req.params.userId);
    if (!recruit) return res.status(404).json({ error: 'not-found' });
    res.json({ data: recruit });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /onboarding/manager/interviews/:userId — backs /app/manager/interviews/[id].
 * Agent 4's "discussion canvas": progress, quiz scores and survey answers, per the route
 * guide. No LLM/narrative generation exists in this codebase (ADR-003) — the canvas is
 * assembled here as structured facts the manager edits/prints themselves, which is what
 * loadRecruit already carries; this endpoint just shapes it for that purpose and never
 * exposes anything the caller couldn't already see via loadRecruit.
 */
router.get('/manager/interviews/:userId', async (req, res, next) => {
  try {
    const recruit = await loadRecruit(req.user, req.params.userId);
    if (!recruit) return res.status(404).json({ error: 'not-found' });

    const instance = recruit.onboardingInstances?.[0] ?? null;

    const surveyRounds = (instance?.surveyRounds ?? []).map((round) => ({
      dayOffset: round.dayOffset,
      dueDate: round.dueDate,
      answered: round._count.responses > 0,
    }));

    const trainingResults = recruit.trainingAttempts.map((attempt) => ({
      moduleFr: attempt.module.titleFr,
      mandatory: attempt.module.isMandatory,
      score: attempt.score,
      passed: attempt.passed,
      startedAt: attempt.startedAt,
    }));

    res.json({
      data: {
        userId: recruit.id,
        displayName: recruit.displayName,
        positionFr: recruit.assignments?.[0]?.position?.titleFr ?? null,
        instance: instance
          ? {
              id: instance.id,
              startDate: instance.startDate,
              probationOutcome: instance.probationOutcome,
              templateFr: instance.template?.titleFr ?? null,
              evaluations: instance.evaluations,
              managerTasks: instance.managerTasks,
            }
          : null,
        trainingResults,
        surveyRounds,
        documentAcknowledgements: recruit.documentAcknowledgements,
        personalFiles: recruit.personalFiles,
      },
    });
  } catch (error) {
    next(error);
  }
});

/** One evaluation, scoped through the subject's structure the same way saveEvaluation is. */
router.get('/evaluations/:id', async (req, res, next) => {
  try {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: req.params.id },
      include: { subject: { select: { id: true, displayName: true } } },
    });
    if (!evaluation) return res.status(404).json({ error: 'not-found' });

    // Re-use listRecruits' perimeter logic: the subject must appear in the caller's own
    // recruit list, or the caller must be the subject themself.
    if (evaluation.subjectId !== req.user.id) {
      const recruits = await listRecruits(req.user, { includeArchived: true });
      const allowed = recruits.some((r) => r.userId === evaluation.subjectId);
      if (!allowed) return res.status(404).json({ error: 'not-found' });
    }

    res.json({ data: evaluation });
  } catch (error) {
    next(error);
  }
});

// ---- mutations --------------------------------------------------------------

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'VALIDATED'];

const SetTaskStatus = z.object({
  instanceId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
  noteFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

router.post('/journey/tasks/status', async (req, res) => {
  const requested = String(req.body?.status ?? '');

  const result = await mutate(req, req.body, {
    schema: SetTaskStatus,
    requires: {
      resource: 'onboarding_task',
      action: requiredActionFor(TASK_STATUSES.includes(requested) ? requested : 'TODO'),
    },
    target: (value) => anchorOfInstance(value.instanceId),
    run: async (value, context) => {
      const existing = await context.tx.onboardingTaskCompletion.findUnique({
        where: { instanceId_milestoneId: { instanceId: value.instanceId, milestoneId: value.milestoneId } },
      });

      const from = existing?.status ?? 'TODO';
      assertTransition(from, value.status);

      const completed = isCompleted(value.status);
      const validated = value.status === 'VALIDATED';

      const data = {
        status: value.status,
        completedAt: completed ? (existing?.completedAt ?? new Date()) : null,
        completedBy: completed ? (existing?.completedBy ?? context.user.id) : null,
        validatedAt: validated ? new Date() : null,
        validatedBy: validated ? context.user.id : null,
        noteFr: value.noteFr ? value.noteFr : (existing?.noteFr ?? null),
      };

      const saved = existing
        ? await context.tx.onboardingTaskCompletion.update({ where: { id: existing.id }, data })
        : await context.tx.onboardingTaskCompletion.create({
            data: { instanceId: value.instanceId, milestoneId: value.milestoneId, ...data },
          });

      await context.audit({
        action: validated ? 'entity.validated' : 'entity.updated',
        entityType: 'onboarding_task',
        entityId: saved.id,
        before: existing ? { status: from } : null,
        after: { status: saved.status },
      });

      if (validated) {
        const instance = await context.tx.onboardingInstance.findUnique({
          where: { id: value.instanceId },
          select: { userId: true },
        });
        const milestone = await context.tx.onboardingMilestone.findUnique({
          where: { id: value.milestoneId },
          select: { titleFr: true },
        });

        if (instance && instance.userId !== context.user.id) {
          await context.tx.notification.create({
            data: {
              userId: instance.userId,
              kind: 'onboarding.task.validated',
              titleFr: 'Étape validée',
              bodyFr: milestone ? `${context.user.displayName} a validé « ${milestone.titleFr} ».` : null,
              href: '/app/me/journey',
            },
          });
        }
      }

      return { status: saved.status };
    },
  });

  sendActionResult(res, result);
});

/**
 * The completion row a comment or a signature attaches to.
 *
 * A task the recruit has never touched has no completion row yet, and there is nothing to
 * hang a comment on. Rather than refusing ("comment on this only after you have started
 * it", which is exactly backwards — you comment *because* you are stuck), the row is created
 * in the TODO state it is already displaying. `loadTaskDetail` is called first so this only
 * ever runs for a task the caller's own journey contains.
 */
async function completionForOwnTask(tx, user, milestoneId) {
  const detail = await loadTaskDetail(user, milestoneId);
  if (!detail) throw Object.assign(new Error('unknown task'), { status: 404 });

  if (detail.task.completionId) {
    return { completionId: detail.task.completionId, detail };
  }

  const created = await tx.onboardingTaskCompletion.create({
    data: {
      instanceId: detail.instanceId,
      milestoneId,
      status: 'TODO',
      dueDate: detail.task.dueDate ?? null,
    },
    select: { id: true },
  });
  return { completionId: created.id, detail };
}

const PostComment = z.object({
  milestoneId: z.string().uuid(),
  bodyFr: z.string().trim().min(1).max(4000),
});

/**
 * POST /journey/tasks/:milestoneId/comments — "request help" / answer, on the task itself.
 *
 * Gated on `onboarding_task:update` against the instance's own anchor, so an EMPLOYEE (SELF
 * scope) passes only for their own journey; the ownership check inside run() is the second,
 * query-level half of that. A manager or HR who may already write on the recruit's tasks can
 * answer in the same thread, which is the point of putting it here.
 */
router.post('/journey/tasks/:milestoneId/comments', async (req, res) => {
  const result = await mutate(req, { milestoneId: req.params.milestoneId, bodyFr: req.body?.bodyFr ?? '' }, {
    schema: PostComment,
    requires: { resource: 'onboarding_task', action: 'update' },
    target: async (value, user) => {
      const detail = await loadTaskDetail(user, value.milestoneId);
      if (!detail) throw Object.assign(new Error('unknown task'), { status: 404 });
      return anchorOfInstance(detail.instanceId);
    },
    run: async (value, context) => {
      const { completionId } = await completionForOwnTask(context.tx, context.user, value.milestoneId);

      const created = await context.tx.taskComment.create({
        data: { completionId, authorId: context.user.id, bodyFr: value.bodyFr },
        select: { id: true },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'task_comment',
        entityId: created.id,
        after: { completionId, milestoneId: value.milestoneId },
      });

      return { comments: await loadTaskComments(completionId) };
    },
  });

  sendActionResult(res, result, 201);
});

const SignTask = z.object({
  milestoneId: z.string().uuid(),
  statementFr: z.string().trim().min(10).max(2000),
});

/**
 * POST /journey/tasks/:milestoneId/sign — records that the caller agreed to a statement.
 *
 * This is an acknowledgement record, not a qualified electronic signature: no certificate
 * authority, signing key or timestamping authority exists in this deployment. The hash is a
 * SHA-256 over signer + completion + the exact wording + the instant, which makes a later
 * edit of the stored statement detectable — it proves nothing about identity beyond the
 * authenticated session that wrote it, and the page says so before the recruit agrees.
 *
 * A second signature by the same signer on the same task is refused (409) rather than
 * silently upserted: re-agreeing is not a new fact, and overwriting the timestamp would
 * destroy the only thing the row is for.
 *
 * Only the journey's own subject may sign. A manager holding `onboarding_task:update` over
 * the recruit's unit passes the permission check, but agreeing on somebody else's behalf is
 * not a thing this record can mean — and it would write a row the recruit's own task page
 * never shows, since that page reads the signature of the journey's subject.
 */
router.post('/journey/tasks/:milestoneId/sign', async (req, res) => {
  const result = await mutate(req, { milestoneId: req.params.milestoneId, statementFr: req.body?.statementFr ?? '' }, {
    schema: SignTask,
    requires: { resource: 'onboarding_task', action: 'update' },
    target: async (value, user) => {
      const detail = await loadTaskDetail(user, value.milestoneId);
      if (!detail) throw Object.assign(new Error('unknown task'), { status: 404 });
      return anchorOfInstance(detail.instanceId);
    },
    run: async (value, context) => {
      const { completionId, detail } = await completionForOwnTask(
        context.tx,
        context.user,
        value.milestoneId,
      );

      // ForbiddenError, not a bare { status: 403 }: mutate() maps 404 and 409 by status but
      // recognises forbidden only by this type, so anything else would surface as a 500.
      if (detail.subjectUserId !== context.user.id) {
        throw new ForbiddenError('update', 'onboarding_task');
      }

      const existing = await context.tx.taskSignature.findUnique({
        where: { completionId_signerId: { completionId, signerId: context.user.id } },
        select: { id: true },
      });
      if (existing) {
        throw Object.assign(new Error('Vous avez déjà signé cette étape.'), { status: 409 });
      }

      const signedAt = new Date();
      const signatureHash = createHash('sha256')
        .update(`${context.user.id}|${completionId}|${value.statementFr}|${signedAt.toISOString()}`)
        .digest('hex');

      const saved = await context.tx.taskSignature.create({
        data: {
          completionId,
          signerId: context.user.id,
          signedAt,
          statementFr: value.statementFr,
          signatureHash,
        },
        select: { id: true, signedAt: true, statementFr: true, signatureHash: true },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'task_signature',
        entityId: saved.id,
        after: { completionId, milestoneId: value.milestoneId, signatureHash },
      });

      return { signature: saved };
    },
  });

  sendActionResult(res, result, 201);
});

const SCORE = z.coerce.number().int().min(1).max(5);

const SaveEvaluation = z.object({
  evaluationId: z.string().uuid(),
  scoreSkills: SCORE,
  scoreAutonomy: SCORE,
  scoreIntegration: SCORE,
  scoreBehaviour: SCORE,
  commentFr: z.string().trim().max(4000).optional(),
  recommendation: z.enum(['CONFIRM', 'EXTEND', 'TERMINATE']),
  submit: z.enum(['draft', 'submit']),
});

/**
 * The subject's org unit and responsable, for the two accepted paths to evaluating them.
 *
 * Who may evaluate: the person's responsable — "when someone has someone under him, it's he
 * who evaluates the ones under him", which is `User.managerId`. That is the hierarchy rule,
 * and it is enforced below as an *additional* accepted path, not a replacement: an evaluator
 * whose org-unit scope already covers the subject (the pre-existing check, which is how a
 * unit-scoped manager or HR reaches an evaluation today) still passes untouched. A manager
 * who is neither the subject's responsable nor in scope is refused, as before.
 */
async function evaluationSubjectContext(evaluationId) {
  const evaluation = await prisma.evaluation.findUniqueOrThrow({
    where: { id: evaluationId },
    select: {
      subject: {
        select: {
          managerId: true,
          assignments: {
            where: { endDate: null },
            select: { position: { select: { organizationUnitId: true } } },
            take: 1,
          },
        },
      },
    },
  });
  return {
    organizationUnitId: evaluation.subject.assignments[0]?.position.organizationUnitId ?? null,
    managerId: evaluation.subject.managerId,
  };
}

router.post('/evaluations/save', async (req, res) => {
  const result = await mutate(req, { ...req.body, submit: req.body?.submit ?? 'draft' }, {
    schema: SaveEvaluation,
    requires: { resource: 'onboarding_instance', action: 'validate' },
    /**
     * When the caller IS the subject's responsable, the target resolves to their own id under
     * SELF scope as well as the subject's unit, so a responsable outside that unit still
     * passes. Otherwise the target is exactly what it was before — the subject's unit — so
     * nothing that worked previously stops working, and nothing new is let through.
     */
    target: async (input, user) => {
      const { organizationUnitId, managerId } = await evaluationSubjectContext(input.evaluationId);
      return managerId === user.id
        ? { organizationUnitId, ownerUserId: user.id }
        : { organizationUnitId };
    },
    run: async (input, context) => {
      const before = await context.tx.evaluation.findUniqueOrThrow({
        where: { id: input.evaluationId },
        select: { id: true, status: true, submittedAt: true },
      });

      if (before.status === 'SUBMITTED') {
        throw Object.assign(
          new Error('Cette évaluation a déjà été transmise aux RH et ne peut plus être modifiée.'),
          { status: 409 },
        );
      }

      const submitting = input.submit === 'submit';

      const saved = await context.tx.evaluation.update({
        where: { id: input.evaluationId },
        data: {
          scoreSkills: input.scoreSkills,
          scoreAutonomy: input.scoreAutonomy,
          scoreIntegration: input.scoreIntegration,
          scoreBehaviour: input.scoreBehaviour,
          commentFr: input.commentFr ?? null,
          recommendation: input.recommendation,
          status: submitting ? 'SUBMITTED' : 'DRAFT',
          evaluatorId: context.user.id,
          submittedAt: submitting ? new Date() : null,
        },
        select: { id: true, instanceId: true, milestone: true },
      });

      if (submitting && saved.milestone === 'PROBATION_END') {
        await context.tx.onboardingInstance.update({
          where: { id: saved.instanceId },
          data: {
            probationOutcome:
              input.recommendation === 'CONFIRM'
                ? 'CONFIRMED'
                : input.recommendation === 'EXTEND'
                  ? 'EXTENDED'
                  : 'TERMINATED',
            outcomeRecordedAt: new Date(),
          },
        });
      }

      await context.audit({
        action: submitting ? 'entity.validated' : 'entity.updated',
        entityType: 'evaluation',
        entityId: saved.id,
        before: { status: before.status },
        after: { status: submitting ? 'SUBMITTED' : 'DRAFT', recommendation: input.recommendation },
      });

      return { evaluationId: saved.id };
    },
  });

  sendActionResult(res, result);
});

const CreateManagerTask = z.object({
  instanceId: z.string().uuid(),
  titleFr: z.string().trim().min(2).max(160),
  detailFr: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  ownerDepartment: z.enum(['HR', 'IT', 'HSE', 'QUALITY', 'MANAGER', 'EMPLOYEE']),
});

router.post('/manager/tasks', async (req, res) => {
  const result = await mutate(req, { ...req.body, ownerDepartment: req.body?.ownerDepartment ?? 'MANAGER' }, {
    schema: CreateManagerTask,
    requires: { resource: 'onboarding_task', action: 'update' },
    target: async (input) => {
      const instance = await prisma.onboardingInstance.findUniqueOrThrow({
        where: { id: input.instanceId },
        select: {
          user: {
            select: {
              assignments: {
                where: { endDate: null },
                select: { position: { select: { organizationUnitId: true } } },
                take: 1,
              },
            },
          },
        },
      });
      return { organizationUnitId: instance.user.assignments[0]?.position.organizationUnitId ?? null };
    },
    run: async (input, context) => {
      const created = await context.tx.managerTask.create({
        data: {
          instanceId: input.instanceId,
          titleFr: input.titleFr,
          detailFr: input.detailFr ?? null,
          dueDate: input.dueDate ?? null,
          ownerDepartment: input.ownerDepartment,
          createdById: context.user.id,
        },
        select: { id: true },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'manager_task',
        entityId: created.id,
        before: null,
        after: { titleFr: input.titleFr, ownerDepartment: input.ownerDepartment },
      });

      return { taskId: created.id };
    },
  });

  sendActionResult(res, result, 201);
});

// ---- trial period (période d'essai) -----------------------------------------

/**
 * The scope predicate for reading onboarding instances, applied in the query (ADR-021):
 * a unit-scoped HR account sees only its own structures' instances.
 */
function instanceScopeWhere(user) {
  const scope = scopeFilterFor(user, 'read', 'onboarding_instance');
  if (scope.kind === 'none') return null;

  if (scope.kind === 'units') {
    return {
      user: {
        assignments: {
          some: { endDate: null, position: { organizationUnitId: { in: scope.organizationUnitIds } } },
        },
      },
    };
  }

  if (scope.kind === 'self') return { userId: user.id };
  return {};
}

/** The evaluation that carries the probation verdict: the most recently submitted one. */
function latestSubmitted(evaluations) {
  return (
    [...evaluations]
      .filter((evaluation) => evaluation.status === 'SUBMITTED')
      .sort((a, b) => new Date(b.submittedAt ?? 0) - new Date(a.submittedAt ?? 0))[0] ?? null
  );
}

/** Shapes one queue entry: the subject, the responsable, the scores and what they suggest. */
function probationEntry(instance) {
  const evaluation = latestSubmitted(instance.evaluations);
  if (!evaluation) return null;

  const scores = {
    scoreSkills: evaluation.scoreSkills,
    scoreAutonomy: evaluation.scoreAutonomy,
    scoreIntegration: evaluation.scoreIntegration,
    scoreBehaviour: evaluation.scoreBehaviour,
  };
  const percent = scorePercent(scores);

  // The responsable who actually evaluated, falling back to the subject's declared manager
  // when the evaluation predates an evaluatorId being recorded.
  const responsable = evaluation.evaluator ?? instance.user.manager ?? null;

  return {
    instanceId: instance.id,
    startDate: instance.startDate,
    probationEndsOn: instance.probationEndsOn,
    probationOutcome: instance.probationOutcome,
    subject: {
      id: instance.user.id,
      displayName: instance.user.displayName,
      positionFr:
        instance.user.assignments[0]?.position.titleFr ?? instance.user.positionTitleFr ?? null,
      directionFr: instance.user.directionFr,
      serviceFr: instance.user.serviceFr,
    },
    responsable: responsable
      ? { id: responsable.id, displayName: responsable.displayName }
      : null,
    evaluation: {
      id: evaluation.id,
      milestone: evaluation.milestone,
      submittedAt: evaluation.submittedAt,
      ...scores,
      total: scoreTotal(scores),
      // The responsable's own call, normalised to a ProbationOutcome so the page can show
      // it beside the computed suggestion and make disagreement visible.
      recommendation: evaluation.recommendation,
      recommendedOutcome: outcomeOfRecommendation(evaluation.recommendation),
    },
    scorePercent: percent,
    suggestedOutcome: suggestedOutcome(percent),
  };
}

/**
 * GET /onboarding/probation/queue — the HR review queue.
 *
 * Every instance whose latest evaluation is SUBMITTED and whose probationOutcome is still
 * ONGOING. HR sees the *result* — scores, percentage, suggestion, and the responsable's own
 * recommendation — not the evaluation form, which stays in the manager portal.
 */
router.get('/probation/queue', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'onboarding_instance');

    const scoped = instanceScopeWhere(req.user);
    if (scoped === null) return res.json({ data: [], thresholds: THRESHOLDS });

    const instances = await prisma.onboardingInstance.findMany({
      where: {
        ...scoped,
        probationOutcome: 'ONGOING',
        evaluations: { some: { status: 'SUBMITTED' } },
      },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        startDate: true,
        probationEndsOn: true,
        probationOutcome: true,
        user: {
          select: {
            id: true,
            displayName: true,
            directionFr: true,
            serviceFr: true,
            positionTitleFr: true,
            manager: { select: { id: true, displayName: true } },
            assignments: {
              where: { endDate: null },
              select: { position: { select: { titleFr: true } } },
              take: 1,
            },
          },
        },
        evaluations: {
          select: {
            id: true,
            milestone: true,
            status: true,
            submittedAt: true,
            scoreSkills: true,
            scoreAutonomy: true,
            scoreIntegration: true,
            scoreBehaviour: true,
            recommendation: true,
            evaluator: { select: { id: true, displayName: true } },
          },
        },
      },
    });

    const data = instances.map(probationEntry).filter(Boolean);
    res.json({ data, thresholds: THRESHOLDS });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/** GET /onboarding/probation/decisions?instanceId= — the decision history for one instance. */
router.get('/probation/decisions', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'onboarding_instance');

    const instanceId = String(req.query.instanceId ?? '');
    if (!instanceId) return res.status(422).json({ error: 'invalid', message: 'instanceId requis.' });

    const scoped = instanceScopeWhere(req.user);
    if (scoped === null) return res.status(403).json({ error: 'forbidden' });

    // Scope is checked on the instance, not the decision rows: an instance outside the
    // caller's perimeter is 404, never found-then-refused.
    const instance = await prisma.onboardingInstance.findFirst({
      where: { id: instanceId, ...scoped },
      select: { id: true },
    });
    if (!instance) return res.status(404).json({ error: 'not-found' });

    const decisions = await prisma.probationDecision.findMany({
      where: { instanceId },
      orderBy: { decidedAt: 'desc' },
      select: {
        id: true,
        scorePercent: true,
        suggestedOutcome: true,
        decidedOutcome: true,
        reasonFr: true,
        decidedAt: true,
        decidedBy: { select: { id: true, displayName: true } },
      },
    });

    res.json({ data: decisions });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const DecideProbation = z.object({
  instanceId: z.string().uuid(),
  decidedOutcome: z.enum(DECIDABLE_OUTCOMES),
  reasonFr: z.string().trim().max(4000).optional().or(z.literal('')),
});

/**
 * POST /onboarding/probation/decide — HR records the trial-period decision.
 *
 * The percentage and the suggestion are recomputed here from the stored scores: a
 * client-sent score or suggestion is never trusted, because the whole point of the record is
 * that it says what the arithmetic actually was. HR may decide against the suggestion, but
 * only with a reason — an outcome that departs from the score and explains nothing is not a
 * decision anyone can audit later. Terminating is never a side effect of arithmetic: it is
 * written here only because a person chose it.
 */
router.post('/probation/decide', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: DecideProbation,
    requires: { resource: 'onboarding_instance', action: 'update' },
    target: async (input) => {
      const instance = await prisma.onboardingInstance.findUniqueOrThrow({
        where: { id: input.instanceId },
        select: {
          user: {
            select: {
              assignments: {
                where: { endDate: null },
                select: { position: { select: { organizationUnitId: true } } },
                take: 1,
              },
            },
          },
        },
      });
      return { organizationUnitId: instance.user.assignments[0]?.position.organizationUnitId ?? null };
    },
    run: async (input, context) => {
      const instance = await context.tx.onboardingInstance.findUnique({
        where: { id: input.instanceId },
        select: {
          id: true,
          userId: true,
          probationOutcome: true,
          evaluations: {
            where: { status: 'SUBMITTED' },
            orderBy: { submittedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              scoreSkills: true,
              scoreAutonomy: true,
              scoreIntegration: true,
              scoreBehaviour: true,
            },
          },
        },
      });
      if (!instance) throw Object.assign(new Error('unknown instance'), { status: 404 });

      // Already decided: refuse rather than overwrite. A second decision on a closed trial
      // period is a double submit, and silently replacing the first would destroy the record.
      if (instance.probationOutcome !== 'ONGOING') {
        throw Object.assign(
          new Error('La période d’essai de ce collaborateur a déjà été tranchée.'),
          { status: 409 },
        );
      }

      const evaluation = instance.evaluations[0] ?? null;
      if (!evaluation) {
        throw Object.assign(
          new Error('Aucune évaluation transmise : le responsable doit d’abord évaluer le collaborateur.'),
          { status: 409 },
        );
      }

      const percent = scorePercent(evaluation);
      if (percent === null) {
        throw Object.assign(
          new Error('L’évaluation transmise est incomplète : les quatre notes sont requises.'),
          { status: 409 },
        );
      }

      const suggestion = suggestedOutcome(percent);
      const reasonFr = input.reasonFr?.trim() ? input.reasonFr.trim() : null;

      // Departing from the suggestion is allowed — doing it silently is not.
      //
      // Thrown as 409 rather than 422 because mutate() maps only 404/409/ForbiddenError by
      // status and passes the message through on 409 alone; a 422 here would reach the client
      // as a bare 500 with the explanation swallowed, which is exactly the wrong outcome for
      // a rule the user has to read in order to comply with it.
      if (input.decidedOutcome !== suggestion && !reasonFr) {
        throw Object.assign(
          new Error(
            'Une décision différente de la suggestion doit être motivée : renseignez le motif.',
          ),
          { status: 409 },
        );
      }

      const decision = await context.tx.probationDecision.create({
        data: {
          instanceId: instance.id,
          evaluationId: evaluation.id,
          scorePercent: percent,
          suggestedOutcome: suggestion,
          decidedOutcome: input.decidedOutcome,
          reasonFr,
          decidedById: context.user.id,
        },
        select: { id: true, decidedAt: true },
      });

      await context.tx.onboardingInstance.update({
        where: { id: instance.id },
        data: { probationOutcome: input.decidedOutcome, outcomeRecordedAt: decision.decidedAt },
      });

      await context.audit({
        action: 'probation.decided',
        entityType: 'probation_decision',
        entityId: decision.id,
        before: { probationOutcome: 'ONGOING' },
        after: {
          instanceId: instance.id,
          scorePercent: percent,
          suggestedOutcome: suggestion,
          decidedOutcome: input.decidedOutcome,
          overridden: input.decidedOutcome !== suggestion,
        },
      });

      return {
        decisionId: decision.id,
        instanceId: instance.id,
        scorePercent: percent,
        suggestedOutcome: suggestion,
        decidedOutcome: input.decidedOutcome,
      };
    },
  });

  sendActionResult(res, result, 201);
});

export default router;
