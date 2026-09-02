import { scopeFilterFor } from '../../domain/auth/authorization.js';
import {
  breakdown,
  isOpen,
  isOverdue,
  responseRate,
  satisfactionPercent,
  surveyDueDate,
  SURVEY_MILESTONES,
} from '../../domain/survey/satisfaction.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * Satisfaction surveys and the aggregate reports.
 * Ported from SoficlefPlatform src/application/survey/rounds.ts.
 */

export async function loadMyRounds(user) {
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
      indicator: response.indicator,
      score: response.score,
      commentFr: response.commentFr,
    })),
  }));
}

export async function loadSatisfaction(user) {
  const scope = scopeFilterFor(user, 'read', 'survey');

  const empty = {
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
                userRoles: { some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } } },
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
    round.responses.map((response) => ({ indicator: response.indicator, score: response.score })),
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
        round.responses.map((response) => ({ indicator: response.indicator, score: response.score })),
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
 * The detailed results view (route guide §2.3, /app/hr/surveys/results): the same
 * aggregate `loadSatisfaction` already computes, plus the per-response detail HR needs to
 * read individual answers, narrowable by division or manager.
 *
 * The headline figures come straight from `loadSatisfaction` rather than being recomputed
 * here — one definition of "the satisfaction score", so this page and the dashboard can
 * never disagree. Only the filtered slice and the individual rows are queried below, and
 * they carry the same scope predicate `loadSatisfaction` applies.
 */
export async function loadSurveyResults(user, filters = {}) {
  const scope = scopeFilterFor(user, 'read', 'survey');

  const overall = await loadSatisfaction(user);

  if (scope.kind === 'none') {
    return { overall, filtered: null, responses: [], byMilestone: overall.byMilestone };
  }

  /*
   * Scope and filters both narrow the same relation, so they are composed into one
   * `instance` predicate rather than layered as two spreads — the second spread would
   * otherwise silently replace the first and widen the scope.
   */
  const subjectWhere = {
    ...(scope.kind === 'self' ? { id: user.id } : {}),
    ...(scope.kind === 'units'
      ? { userRoles: { some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } } } }
      : {}),
    ...(filters.managerId ? { managerId: filters.managerId } : {}),
    ...(filters.unitCode
      ? {
          assignments: {
            some: { endDate: null, position: { organizationUnit: { code: filters.unitCode } } },
          },
        }
      : {}),
  };

  const rounds = await prisma.surveyRound.findMany({
    where: Object.keys(subjectWhere).length > 0 ? { instance: { user: subjectWhere } } : {},
    orderBy: [{ dayOffset: 'asc' }],
    select: {
      id: true,
      dayOffset: true,
      dueDate: true,
      answeredAt: true,
      instance: {
        select: {
          user: {
            select: {
              id: true,
              displayName: true,
              manager: { select: { id: true, displayName: true } },
              assignments: {
                where: { endDate: null },
                take: 1,
                select: {
                  position: {
                    select: { titleFr: true, organizationUnit: { select: { code: true, nameFr: true } } },
                  },
                },
              },
            },
          },
        },
      },
      responses: { select: { indicator: true, score: true, commentFr: true } },
    },
  });

  const allResponses = rounds.flatMap((round) =>
    round.responses.map((response) => ({ indicator: response.indicator, score: response.score })),
  );

  const filtered = {
    score: satisfactionPercent(allResponses),
    responseRate: responseRate(rounds),
    roundsIssued: rounds.length,
    roundsAnswered: rounds.filter((round) => round.answeredAt !== null).length,
    indicators: breakdown(allResponses),
  };

  const byMilestone = SURVEY_MILESTONES.map((dayOffset) => {
    const atMilestone = rounds.filter((round) => round.dayOffset === dayOffset);
    const responses = atMilestone.flatMap((round) =>
      round.responses.map((response) => ({ indicator: response.indicator, score: response.score })),
    );
    return {
      dayOffset,
      score: satisfactionPercent(responses),
      issued: atMilestone.length,
      answered: atMilestone.filter((round) => round.answeredAt !== null).length,
    };
  });

  // Individual responses — only rounds actually answered carry anything to read.
  const responses = rounds
    .filter((round) => round.answeredAt !== null)
    .map((round) => {
      const subject = round.instance.user;
      const assignment = subject.assignments[0];
      return {
        roundId: round.id,
        dayOffset: round.dayOffset,
        answeredAt: round.answeredAt,
        userId: subject.id,
        displayName: subject.displayName,
        managerName: subject.manager?.displayName ?? null,
        positionFr: assignment?.position.titleFr ?? null,
        unitCode: assignment?.position.organizationUnit?.code ?? null,
        unitNameFr: assignment?.position.organizationUnit?.nameFr ?? null,
        score: satisfactionPercent(round.responses),
        commentFr: round.responses.find((response) => response.commentFr)?.commentFr ?? null,
        scores: round.responses.map((response) => ({ indicator: response.indicator, score: response.score })),
      };
    })
    .sort((a, b) => new Date(b.answeredAt) - new Date(a.answeredAt));

  return { overall, filtered, byMilestone, responses };
}

/**
 * Creates the four rounds for a journey (J+7, J+30, J+60, J+90). Idempotent.
 * Exported so the assignments flow can call it when an onboarding instance is created.
 */
export async function ensureRoundsFor(instanceId, startDate, tx = prisma) {
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
