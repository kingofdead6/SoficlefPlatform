import 'server-only';

import { scopeFilterFor, type AuthenticatedUser } from '@/domain/auth/authorization';
import {
  breakdown,
  isOpen,
  isOverdue,
  responseRate,
  satisfactionPercent,
  surveyDueDate,
  SURVEY_MILESTONES,
  type IndicatorBreakdown,
  type SurveyIndicator,
} from '@/domain/survey/satisfaction';
import { prisma } from '@/infrastructure/db/client';

/**
 * Satisfaction surveys (CDC-2026 Module 9) and the aggregate §10 reports.
 *
 * Two reads with deliberately different shapes: a collaborator gets their own rounds with
 * the questions, and everyone else gets aggregates with no individual answer attached.
 * That split is the privacy boundary — a manager needs to know their team scored 62%, not
 * which person said what.
 */

export interface MyRound {
  id: string;
  dayOffset: number;
  dueDate: Date;
  answeredAt: Date | null;
  open: boolean;
  overdue: boolean;
  responses: { indicator: SurveyIndicator; score: number; commentFr: string | null }[];
}

/** The signed-in person's own rounds, with whatever they have already answered. */
export async function loadMyRounds(user: AuthenticatedUser): Promise<MyRound[]> {
  const rounds = await prisma.surveyRound.findMany({
    where: { instance: { userId: user.id } },
    orderBy: { dayOffset: 'asc' },
    include: { responses: { select: { indicator: true, score: true, commentFr: true } } },
  });

  const now = new Date();
  return rounds.map((round) => ({
    id: round.id,
    dayOffset: round.dayOffset,
    dueDate: round.dueDate,
    answeredAt: round.answeredAt,
    open: isOpen(round, now),
    overdue: isOverdue(round, now),
    responses: round.responses.map((response) => ({
      indicator: response.indicator as SurveyIndicator,
      score: response.score,
      commentFr: response.commentFr,
    })),
  }));
}

export interface SatisfactionSummary {
  /** 0–100, the figure §8.2 sets an 85% floor on. Null when nobody has answered. */
  score: number | null;
  /** Answered rounds over issued rounds. */
  responseRate: number | null;
  roundsIssued: number;
  roundsAnswered: number;
  roundsOverdue: number;
  indicators: IndicatorBreakdown[];
  /** Per-milestone scores, so a drop between J+30 and J+60 is visible. */
  byMilestone: { dayOffset: number; score: number | null; answered: number }[];
}

/**
 * The aggregate satisfaction picture for whatever the caller may see.
 *
 * Scope is applied in the query (ADR-021): a manager's figures cover the people in their
 * structures, HR's cover the organization. Individual responses never leave this
 * function — only counts and averages do.
 */
export async function loadSatisfaction(user: AuthenticatedUser): Promise<SatisfactionSummary> {
  const scope = scopeFilterFor(user, 'read', 'survey');

  const empty: SatisfactionSummary = {
    score: null,
    responseRate: null,
    roundsIssued: 0,
    roundsAnswered: 0,
    roundsOverdue: 0,
    indicators: breakdown([]),
    byMilestone: SURVEY_MILESTONES.map((dayOffset) => ({ dayOffset, score: null, answered: 0 })),
  };

  if (scope.kind === 'none') return empty;

  const where =
    scope.kind === 'self'
      ? { instance: { userId: user.id } }
      : scope.kind === 'units'
        ? {
            instance: {
              user: {
                userRoles: {
                  some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } },
                },
              },
            },
          }
        : {};

  const rounds = await prisma.surveyRound.findMany({
    where,
    include: { responses: { select: { indicator: true, score: true } } },
  });

  if (rounds.length === 0) return empty;

  const now = new Date();
  const allResponses = rounds.flatMap((round) =>
    round.responses.map((response) => ({
      indicator: response.indicator as SurveyIndicator,
      score: response.score,
    })),
  );

  return {
    score: satisfactionPercent(allResponses),
    responseRate: responseRate(rounds),
    roundsIssued: rounds.length,
    roundsAnswered: rounds.filter((round) => round.answeredAt !== null).length,
    roundsOverdue: rounds.filter((round) => isOverdue(round, now)).length,
    indicators: breakdown(allResponses),
    byMilestone: SURVEY_MILESTONES.map((dayOffset) => {
      const atMilestone = rounds.filter((round) => round.dayOffset === dayOffset);
      const responses = atMilestone.flatMap((round) =>
        round.responses.map((response) => ({
          indicator: response.indicator as SurveyIndicator,
          score: response.score,
        })),
      );
      return {
        dayOffset,
        score: satisfactionPercent(responses),
        answered: atMilestone.filter((round) => round.answeredAt !== null).length,
      };
    }),
  };
}

/**
 * Creates the four rounds for a journey (§9's J+7, J+30, J+60, J+90).
 *
 * Idempotent, and called when a journey is instantiated: the dates exist as data from day
 * one, so a dashboard can show what is due without waiting for a scheduler, and a missed
 * scheduler tick cannot lose a round.
 */
export async function ensureRoundsFor(
  instanceId: string,
  startDate: Date,
  tx: Pick<typeof prisma, 'surveyRound'> = prisma,
): Promise<number> {
  let created = 0;
  for (const dayOffset of SURVEY_MILESTONES) {
    await tx.surveyRound.upsert({
      where: { instanceId_dayOffset: { instanceId, dayOffset } },
      create: { instanceId, dayOffset, dueDate: surveyDueDate(startDate, dayOffset) },
      update: { dueDate: surveyDueDate(startDate, dayOffset) },
    });
    created += 1;
  }
  return created;
}
