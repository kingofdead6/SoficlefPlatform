'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';
import { grade } from '@/domain/training/quiz';

/**
 * Sitting a training quiz (CDC-2026 Module 6).
 *
 * The grading happens here, on the server, against `correctOption` columns that were
 * never sent to the browser. That is the whole point: a mandatory HSE certification
 * graded client-side would be a certification anybody can award themselves.
 *
 * An attempt is append-only, like an assessment — a retake is a new row, so the record of
 * how somebody reached a pass survives.
 */

const SubmitQuiz = z.object({
  moduleId: z.string().uuid(),
  /** `{ questionId: optionId }`. Both are opaque ids, so a loose record is right here. */
  answers: z.record(z.string().uuid(), z.string().min(1).max(64)),
});

export interface QuizOutcome {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  certified: boolean;
}

export async function submitQuiz(
  _previous: ActionResult<QuizOutcome> | null,
  formData: FormData,
): Promise<ActionResult<QuizOutcome>> {
  const answers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    // Answers arrive as `answer:<questionId>` so they cannot collide with other fields.
    if (key.startsWith('answer:') && typeof value === 'string') {
      answers[key.slice('answer:'.length)] = value;
    }
  }

  const result = await mutate(
    { moduleId: formData.get('moduleId'), answers },
    {
      schema: SubmitQuiz,
      requires: { resource: 'training', action: 'update' },
      // Self-scoped: a person sits their own quiz.
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
          throw Object.assign(
            new Error("Ce module ne comporte pas encore de questions."),
            { status: 409 },
          );
        }

        const outcome = grade(trainingModule.questions, value.answers, trainingModule.passingScore);

        // Certify on the first pass only, so the certification date is when the person
        // actually qualified rather than when they last happened to retake it.
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
    },
  );

  if (result.ok) {
    revalidatePath('/[locale]/(app)/training', 'page');
    revalidatePath('/[locale]/(app)/dashboard', 'page');
  }
  return result;
}
