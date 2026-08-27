import 'server-only';

import { loadJourney, type JourneyTask } from '@/application/onboarding/journey';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { canAnyScope } from '@/domain/auth/authorization';
import { prisma } from '@/infrastructure/db/client';
import { currentPositionIdFor } from '@/infrastructure/repositories/position-repository';

/**
 * The new arrival's own view of their onboarding.
 *
 * Everything here is about the caller and nobody else: the reads are anchored on
 * `user.id` rather than scoped-and-filtered, so there is no version of this module that
 * could return a colleague's row even if called wrongly.
 */

export type Phase = 'PRE_ONBOARDING' | 'DAY_ONE' | 'PROBATION' | 'COMPLETED';

export interface MeOverview {
  displayName: string;
  /** Days since the journey started; negative before it does. */
  dayNumber: number | null;
  startDate: Date | null;
  phase: Phase;
  progress: { total: number; done: number; percent: number };
  /** The three things to do next, soonest deadline first. */
  nextTasks: JourneyTask[];
  overdueCount: number;
  position: { titleFr: string; missionFr: string | null } | null;
  manager: { displayName: string; email: string; phone: string | null } | null;
  hrContact: { nameFr: string; roleFr: string; extension: string } | null;
  /** Surveys open for the caller right now. */
  openSurveys: number;
  /** Mandatory training modules not yet passed. */
  trainingOutstanding: number;
}

/**
 * Which phase the journey is in.
 *
 * Derived from the day number rather than stored, because a stored phase is a second
 * source of truth that drifts the moment a start date is corrected. The boundaries follow
 * CDC-2026 §2: everything before the arrival, the arrival itself, then the probation.
 */
export function phaseFor(dayNumber: number | null, allDone: boolean): Phase {
  if (allDone) return 'COMPLETED';
  if (dayNumber === null) return 'PRE_ONBOARDING';
  if (dayNumber < 0) return 'PRE_ONBOARDING';
  if (dayNumber === 0) return 'DAY_ONE';
  return 'PROBATION';
}

/** Whole days between two dates, ignoring the time of day. */
function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

export async function loadMeOverview(user: AuthenticatedUser): Promise<MeOverview> {
  const journey = await loadJourney(user).catch(() => null);

  const startDate = journey?.startDate ?? user.onboardingStartDate ?? null;
  const dayNumber = startDate ? daysBetween(startDate, new Date()) : null;

  const tasks = journey?.tasks ?? [];
  const done = tasks.filter(
    (task) => task.status === 'DONE' || task.status === 'VALIDATED',
  ).length;
  const total = tasks.length;

  /*
   * The next three, by deadline. Tasks already done drop out, and a task with no due date
   * sorts last rather than first — an undated task is not urgent, and putting it at the
   * top of "what to do next" would bury the ones that are.
   */
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
          .findUnique({
            where: { id: positionId },
            select: { titleFr: true, missionFr: true },
          })
          .catch(() => null)
      : Promise.resolve(null),

    prisma.user
      .findUnique({
        where: { id: user.id },
        select: { manager: { select: { displayName: true, email: true, phone: true } } },
      })
      .then((row) => row?.manager ?? null)
      .catch(() => null),

    // The HR contact to chase, from the directory rather than a hardcoded name.
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
