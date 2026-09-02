import { loadJourney } from '../onboarding/journey.js';
import { canAnyScope } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * The new arrival's own view of their onboarding.
 * Ported from SoficlefPlatform src/application/me/overview.ts.
 */

export function phaseFor(dayNumber, allDone) {
  if (allDone) return 'COMPLETED';
  if (dayNumber === null) return 'PRE_ONBOARDING';
  if (dayNumber < 0) return 'PRE_ONBOARDING';
  if (dayNumber === 0) return 'DAY_ONE';
  return 'PROBATION';
}

function daysBetween(from, to) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** The position id currently occupied by this user (latest open assignment), or null. */
async function currentPositionIdFor(userId) {
  const assignment = await prisma.assignment.findFirst({
    where: { userId, endDate: null },
    orderBy: { startDate: 'desc' },
    select: { positionId: true },
  });
  return assignment?.positionId ?? null;
}

export async function loadMeOverview(user) {
  const journey = await loadJourney(user).catch(() => null);

  const startDate = journey?.startDate ?? user.onboardingStartDate ?? null;
  const dayNumber = startDate ? daysBetween(startDate, new Date()) : null;

  const tasks = journey?.tasks ?? [];
  const done = tasks.filter((task) => task.status === 'DONE' || task.status === 'VALIDATED').length;
  const total = tasks.length;

  const nextTasks = tasks
    .filter((task) => task.status !== 'DONE' && task.status !== 'VALIDATED')
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.dayOffset - b.dayOffset;
    })
    .slice(0, 3);

  const positionId = await currentPositionIdFor(user.id).catch(() => null);

  const [position, manager, hrContact, openSurveys, trainingOutstanding] = await Promise.all([
    positionId
      ? prisma.position
          .findUnique({ where: { id: positionId }, select: { titleFr: true, missionFr: true } })
          .catch(() => null)
      : Promise.resolve(null),

    prisma.user
      .findUnique({
        where: { id: user.id },
        select: { manager: { select: { displayName: true, email: true, phone: true } } },
      })
      .then((row) => row?.manager ?? null)
      .catch(() => null),

    prisma.contact
      .findFirst({
        where: { roleFr: { contains: 'Emploi', mode: 'insensitive' } },
        select: { nameFr: true, roleFr: true, extension: true },
      })
      .catch(() => null),

    journey
      ? prisma.surveyRound
          .count({
            where: {
              instanceId: journey.instanceId,
              dueDate: { lte: new Date() },
              responses: { none: { userId: user.id } },
            },
          })
          .catch(() => 0)
      : Promise.resolve(0),

    canAnyScope(user, 'read', 'training')
      ? prisma.trainingModule
          .count({
            where: {
              archivedAt: null,
              isMandatory: true,
              attempts: { none: { userId: user.id, passed: true } },
            },
          })
          .catch(() => 0)
      : Promise.resolve(0),
  ]);

  return {
    displayName: user.displayName,
    dayNumber,
    startDate,
    phase: phaseFor(dayNumber, total > 0 && done === total),
    progress: { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) },
    nextTasks,
    overdueCount: tasks.filter((task) => task.overdue).length,
    position,
    manager,
    hrContact,
    openSurveys,
    trainingOutstanding,
  };
}
