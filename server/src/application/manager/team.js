import { scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';

export { alertsFor } from '../../domain/manager/alerts.js';

/**
 * What a manager sees of their own team.
 * Ported from SoficlefPlatform src/application/manager/team.ts.
 */

function perimeterOf(user) {
  const scope = scopeFilterFor(user, 'read', 'onboarding_instance');
  if (scope.kind === 'units') return scope.organizationUnitIds;
  if (scope.kind === 'all') return [];
  return null;
}

const daysBetween = (from, to) => {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
};

const MILESTONE_LABELS = {
  DAY_30: 'Point J+30',
  DAY_90: 'Point J+90',
  PROBATION_END: 'Fin de période d’essai',
};

export async function listRecruits(user, options = {}) {
  const units = perimeterOf(user);
  if (units === null) return [];

  const instances = await prisma.onboardingInstance.findMany({
    where: {
      ...(options.includeArchived ? {} : { completedAt: null }),
      ...(units.length > 0
        ? {
            user: {
              assignments: {
                some: { endDate: null, position: { organizationUnitId: { in: units } } },
              },
            },
          }
        : {}),
      NOT: { userId: user.id },
    },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      startDate: true,
      completedAt: true,
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          assignments: {
            where: { endDate: null },
            select: { position: { select: { titleFr: true } } },
            take: 1,
          },
        },
      },
      template: { select: { _count: { select: { milestones: true } } } },
      taskCompletions: { select: { status: true, dueDate: true } },
      evaluations: {
        where: { status: { in: ['DUE', 'DRAFT'] } },
        orderBy: { dueDate: 'asc' },
        select: { id: true, milestone: true, dueDate: true },
      },
    },
  });

  const now = new Date();

  return instances.map((instance) => {
    const total = instance.template._count.milestones;
    const done = instance.taskCompletions.filter(
      (task) => task.status === 'DONE' || task.status === 'VALIDATED',
    ).length;

    return {
      userId: instance.user.id,
      displayName: instance.user.displayName,
      email: instance.user.email,
      instanceId: instance.id,
      positionFr: instance.user.assignments[0]?.position.titleFr ?? null,
      startDate: instance.startDate,
      dayNumber: daysBetween(instance.startDate, now),
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
      done,
      total,
      overdue: instance.taskCompletions.filter(
        (task) =>
          task.dueDate !== null &&
          task.dueDate < now &&
          task.status !== 'DONE' &&
          task.status !== 'VALIDATED',
      ).length,
      blocked: instance.taskCompletions.filter((task) => task.status === 'BLOCKED').length,
      completed: instance.completedAt !== null,
      evaluationsDue: instance.evaluations.map((evaluation) => ({
        id: evaluation.id,
        milestone: MILESTONE_LABELS[evaluation.milestone] ?? evaluation.milestone,
        dueDate: evaluation.dueDate,
      })),
    };
  });
}

export async function loadRecruit(user, subjectId) {
  const units = perimeterOf(user);
  if (units === null) return null;

  return prisma.user.findFirst({
    where: {
      id: subjectId,
      ...(units.length > 0
        ? { assignments: { some: { endDate: null, position: { organizationUnitId: { in: units } } } } }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      hireDate: true,
      onboardingStartDate: true,
      assignments: {
        where: { endDate: null },
        select: {
          position: {
            select: {
              titleFr: true,
              organizationUnitId: true,
              organizationUnit: { select: { code: true, nameFr: true } },
            },
          },
        },
        take: 1,
      },
      onboardingInstances: {
        orderBy: { startDate: 'desc' },
        take: 1,
        select: {
          id: true,
          startDate: true,
          completedAt: true,
          probationOutcome: true,
          template: { select: { titleFr: true } },
          evaluations: {
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              milestone: true,
              dueDate: true,
              status: true,
              recommendation: true,
              submittedAt: true,
            },
          },
          managerTasks: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              titleFr: true,
              detailFr: true,
              dueDate: true,
              status: true,
              ownerDepartment: true,
            },
          },
          surveyRounds: {
            orderBy: { dayOffset: 'asc' },
            select: { dayOffset: true, dueDate: true, _count: { select: { responses: true } } },
          },
        },
      },
      trainingAttempts: {
        orderBy: { startedAt: 'desc' },
        select: {
          passed: true,
          score: true,
          startedAt: true,
          module: { select: { titleFr: true, isMandatory: true } },
        },
      },
      documentAcknowledgements: {
        select: { acceptedAt: true, document: { select: { titleFr: true } } },
      },
      personalFiles: {
        orderBy: { labelFr: 'asc' },
        select: { id: true, labelFr: true, status: true },
      },
    },
  });
}
