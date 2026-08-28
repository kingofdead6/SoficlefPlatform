import 'server-only';

import { loadSatisfaction } from '@/application/survey/rounds';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { scopeFilterFor } from '@/domain/auth/authorization';
import { prisma } from '@/infrastructure/db/client';

/**
 * The HR dashboard (CDC-2026 Module 10).
 *
 * Counters that answer one question each: is anybody stuck, is anybody late, is the
 * experience good. Anything that cannot be computed honestly is returned as null and
 * rendered as "—" rather than as a zero, because a zero reads as a measurement.
 */

export interface HrAlert {
  id: string;
  kind: 'unassigned' | 'overdue' | 'survey' | 'files';
  severity: 'red' | 'blue';
  titleFr: string;
  detailFr: string;
  href: string;
}

export interface HrDashboard {
  hiresThisMonth: number;
  onboardingsInProgress: number;
  onboardingsCompleted: number;
  onboardingsLate: number;
  /** Completion across every running journey, 0–100. Null when none are running. */
  completionPercent: number | null;
  satisfactionPercent: number | null;
  pendingAssignments: number;
  alerts: HrAlert[];
}

export async function loadHrDashboard(user: AuthenticatedUser): Promise<HrDashboard> {
  const scope = scopeFilterFor(user, 'read', 'assignment');

  /*
   * The perimeter, expressed once and reused. A unit-scoped HR account counts only people
   * whose current post is in their structures — the same predicate the directory uses, so
   * the dashboard and the list can never disagree about who exists.
   */
  const withinScope =
    scope.kind === 'units'
      ? {
          user: {
            assignments: {
              some: {
                endDate: null,
                position: { organizationUnitId: { in: scope.organizationUnitIds } },
              },
            },
          },
        }
      : {};

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [hiresThisMonth, running, completed, pendingAssignments, satisfaction] =
    await Promise.all([
      prisma.user
        .count({
          where: {
            hireDate: { gte: monthStart },
            ...(scope.kind === 'units'
              ? {
                  assignments: {
                    some: {
                      endDate: null,
                      position: { organizationUnitId: { in: scope.organizationUnitIds } },
                    },
                  },
                }
              : {}),
          },
        })
        .catch(() => 0),

      prisma.onboardingInstance
        .findMany({
          where: { completedAt: null, ...withinScope },
          select: {
            id: true,
            startDate: true,
            user: { select: { id: true, displayName: true } },
            template: { select: { _count: { select: { milestones: true } } } },
            taskCompletions: {
              select: { status: true, dueDate: true },
            },
          },
        })
        .catch(() => []),

      prisma.onboardingInstance
        .count({ where: { completedAt: { not: null }, ...withinScope } })
        .catch(() => 0),

      prisma.user
        .count({ where: { lifecycleState: 'PENDING_ASSIGNMENT', status: 'ACTIVE' } })
        .catch(() => 0),

      loadSatisfaction(user).catch(() => null),
    ]);

  let totalTasks = 0;
  let doneTasks = 0;
  let late = 0;
  const alerts: HrAlert[] = [];

  for (const instance of running) {
    const expected = instance.template._count.milestones;
    const done = instance.taskCompletions.filter(
      (task) => task.status === 'DONE' || task.status === 'VALIDATED',
    ).length;

    totalTasks += expected;
    doneTasks += done;

    const overdue = instance.taskCompletions.filter(
      (task) =>
        task.dueDate !== null &&
        task.dueDate < now &&
        task.status !== 'DONE' &&
        task.status !== 'VALIDATED',
    ).length;

    if (overdue > 0) {
      late += 1;
      alerts.push({
        id: `overdue-${instance.id}`,
        kind: 'overdue',
        severity: 'red',
        titleFr: `${instance.user.displayName} — ${overdue} étape${overdue > 1 ? 's' : ''} en retard`,
        detailFr: 'Le parcours a dépassé une échéance.',
        href: `/app/hr/employees/${instance.user.id}`,
      });
    }
  }

  if (pendingAssignments > 0) {
    alerts.unshift({
      id: 'unassigned',
      kind: 'unassigned',
      severity: 'red',
      titleFr: `${pendingAssignments} compte${pendingAssignments > 1 ? 's' : ''} sans affectation`,
      detailFr: 'Ces personnes ne voient qu’un message d’attente tant qu’elles n’ont pas de poste.',
      href: '/app/hr/employees/unassigned',
    });
  }

  // Papers HR is still waiting on, across the perimeter.
  const filesOutstanding = await prisma.personalFile
    .count({ where: { status: { in: ['REQUESTED', 'REJECTED'] } } })
    .catch(() => 0);

  if (filesOutstanding > 0) {
    alerts.push({
      id: 'files',
      kind: 'files',
      severity: 'blue',
      titleFr: `${filesOutstanding} pièce${filesOutstanding > 1 ? 's' : ''} administrative${filesOutstanding > 1 ? 's' : ''} en attente`,
      detailFr: 'Dossiers incomplets : pièce d’identité, diplômes, RIB ou visite médicale.',
      href: '/app/hr/employees',
    });
  }

  return {
    hiresThisMonth,
    onboardingsInProgress: running.length,
    onboardingsCompleted: completed,
    onboardingsLate: late,
    completionPercent: totalTasks === 0 ? null : Math.round((doneTasks / totalTasks) * 100),
    satisfactionPercent: satisfaction?.score ?? null,
    pendingAssignments,
    alerts,
  };
}
