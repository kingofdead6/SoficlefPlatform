'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';
import { prisma } from '@/infrastructure/db/client';

/**
 * Milestone evaluations, and the ad-hoc tasks a manager adds to a path.
 *
 * Both are scoped through the position tree rather than through a `managerId` column: a
 * manager reaches a person because that person's seat is inside their structures, which is
 * the same rule the org chart draws and cannot disagree with it.
 */

const SCORE = z.coerce.number().int().min(1).max(5);

const SaveEvaluation = z.object({
  evaluationId: z.string().uuid(),
  scoreSkills: SCORE,
  scoreAutonomy: SCORE,
  scoreIntegration: SCORE,
  scoreBehaviour: SCORE,
  commentFr: z.string().trim().max(4000).optional(),
  recommendation: z.enum(['CONFIRM', 'EXTEND', 'TERMINATE']),
  /** A draft can be revised; a submitted review is the manager's word to HR. */
  submit: z.enum(['draft', 'submit']),
});

/** The unit the evaluation's subject currently sits in — the anchor `can()` checks. */
async function unitOfEvaluation(evaluationId: string): Promise<string | null> {
  const evaluation = await prisma.evaluation.findUniqueOrThrow({
    where: { id: evaluationId },
    select: {
      subject: {
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
  return evaluation.subject.assignments[0]?.position.organizationUnitId ?? null;
}

export async function saveEvaluation(
  _previous: ActionResult<{ evaluationId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ evaluationId: string }>> {
  const value = (key: string) => {
    const raw = formData.get(key);
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
  };

  const result = await mutate(
    {
      evaluationId: value('evaluationId'),
      scoreSkills: value('scoreSkills'),
      scoreAutonomy: value('scoreAutonomy'),
      scoreIntegration: value('scoreIntegration'),
      scoreBehaviour: value('scoreBehaviour'),
      commentFr: value('commentFr'),
      recommendation: value('recommendation'),
      submit: value('submit') ?? 'draft',
    },
    {
      schema: SaveEvaluation,
      // Judging somebody's probation is a validation, not an edit.
      requires: { resource: 'onboarding_instance', action: 'validate' },
      target: async (input) => ({ organizationUnitId: await unitOfEvaluation(input.evaluationId) }),
      run: async (input, context) => {
        const before = await context.tx.evaluation.findUniqueOrThrow({
          where: { id: input.evaluationId },
          select: { id: true, status: true, submittedAt: true },
        });

        /*
         * A submitted review is final. Reopening it would let a recommendation change
         * after HR has read it, which is precisely the thing a recommendation must not do.
         */
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

        /*
         * The probation outcome follows the recommendation, but only once the review is
         * actually submitted and only at the end of the period. A D+30 review that
         * recommends confirmation is an opinion, not a decision.
         */
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
    },
  );

  if (result.ok) {
    for (const path of ['/app/manager', '/app/manager/evaluations', '/app/manager/recruits']) {
      revalidatePath(`/[locale]${path}`, 'page');
    }
  }

  return result;
}

const CreateManagerTask = z.object({
  instanceId: z.string().uuid(),
  titleFr: z.string().trim().min(2).max(160),
  detailFr: z.string().trim().max(2000).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  ownerDepartment: z.enum(['HR', 'IT', 'HSE', 'QUALITY', 'MANAGER', 'EMPLOYEE']),
});

export async function createManagerTask(
  _previous: ActionResult<{ taskId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ taskId: string }>> {
  const value = (key: string) => {
    const raw = formData.get(key);
    return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
  };

  const result = await mutate(
    {
      instanceId: value('instanceId'),
      titleFr: value('titleFr'),
      detailFr: value('detailFr'),
      dueDate: value('dueDate') ?? null,
      ownerDepartment: value('ownerDepartment') ?? 'MANAGER',
    },
    {
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
        return {
          organizationUnitId:
            instance.user.assignments[0]?.position.organizationUnitId ?? null,
        };
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
    },
  );

  if (result.ok) {
    revalidatePath('/[locale]/app/manager/recruits', 'page');
    revalidatePath('/[locale]/app/me/journey', 'page');
  }

  return result;
}
