'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';
import {
  SCORE_MAX,
  SCORE_MIN,
  SURVEY_INDICATORS,
  isOpen,
} from '@/domain/survey/satisfaction';

/**
 * Submitting a satisfaction survey (CDC-2026 Module 9).
 *
 * Answers belong to the person who gave them: the round is resolved from the database and
 * checked against the session, so a payload naming somebody else's round is refused
 * rather than trusted. `answeredAt` is set once — a submitted survey is a record of what
 * somebody thought at that milestone, not a document they keep revising.
 */

const SubmitSurvey = z.object({
  roundId: z.string().uuid(),
  scores: z.record(z.enum(SURVEY_INDICATORS), z.coerce.number().int().min(SCORE_MIN).max(SCORE_MAX)),
  commentFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function submitSurvey(
  _previous: ActionResult<{ answered: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ answered: number }>> {
  const scores: Record<string, unknown> = {};
  for (const indicator of SURVEY_INDICATORS) {
    const raw = formData.get(indicator);
    if (typeof raw === 'string' && raw.length > 0) scores[indicator] = raw;
  }

  const result = await mutate(
    {
      roundId: formData.get('roundId'),
      scores,
      commentFr: formData.get('commentFr') ?? '',
    },
    {
      schema: SubmitSurvey,
      requires: { resource: 'survey', action: 'update' },
      // Self-scoped: a collaborator answers their own round and nobody else's.
      target: (_value, user) => ({ ownerUserId: user.id }),
      run: async (value, context) => {
        const round = await context.tx.surveyRound.findUnique({
          where: { id: value.roundId },
          select: {
            id: true,
            dayOffset: true,
            dueDate: true,
            answeredAt: true,
            instance: { select: { userId: true } },
          },
        });
        if (!round) throw Object.assign(new Error('unknown round'), { status: 404 });

        // The round must belong to the person submitting it. Checked here rather than
        // only in `can()` because the payload names the round, and an id is guessable.
        if (round.instance.userId !== context.user.id) {
          throw Object.assign(new Error('not your survey'), { status: 403 });
        }

        if (round.answeredAt) {
          throw Object.assign(new Error('Cette enquête a déjà été renseignée.'), { status: 409 });
        }

        if (!isOpen({ ...round, answeredAt: null })) {
          throw Object.assign(
            new Error("Cette enquête n'est pas encore ouverte."),
            { status: 409 },
          );
        }

        const entries = Object.entries(value.scores) as [
          (typeof SURVEY_INDICATORS)[number],
          number,
        ][];
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
              // The free-text comment is stored once, against the first indicator, rather
              // than repeated on all five.
              commentFr: value.commentFr ? value.commentFr : null,
            },
            update: { score },
          });
        }

        await context.tx.surveyRound.update({
          where: { id: round.id },
          data: { answeredAt: new Date() },
        });

        await context.audit({
          action: 'entity.created',
          entityType: 'survey_round',
          entityId: round.id,
          // The scores themselves stay out of the audit trail: it records that somebody
          // answered, not what they said. The answers live in one place, readable only
          // through the aggregate.
          after: { dayOffset: round.dayOffset, indicators: entries.length },
        });

        return { answered: entries.length };
      },
    },
  );

  if (result.ok) {
    revalidatePath('/[locale]/(app)/surveys', 'page');
    revalidatePath('/[locale]/(app)/dashboard', 'page');
  }
  return result;
}
