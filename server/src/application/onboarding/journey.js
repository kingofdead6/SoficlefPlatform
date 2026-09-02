import { dueDateFor, isDueSoon, isOverdue, progressOf } from '../../domain/onboarding/task.js';
import { scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * Reads an onboarding journey with its tasks, deadlines and progress.
 * Ported from SoficlefPlatform src/application/onboarding/journey.ts.
 */

/** The journey of one person, or the caller's own when no subject is given. */
export async function loadJourney(user, options = {}) {
  const scope = scopeFilterFor(user, 'read', 'onboarding_task');
  if (scope.kind === 'none') return null;

  const subjectUserId = scope.kind === 'self' ? user.id : (options.subjectUserId ?? user.id);

  const withinPerimeter =
    scope.kind === 'units' && subjectUserId !== user.id
      ? {
          user: {
            userRoles: {
              some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } },
            },
          },
        }
      : {};

  const instance = await prisma.onboardingInstance.findFirst({
    where: {
      ...(options.instanceId ? { id: options.instanceId } : {}),
      userId: subjectUserId,
      ...withinPerimeter,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, displayName: true } },
      template: { include: { milestones: { orderBy: { order: 'asc' } } } },
      taskCompletions: true,
    },
  });
  if (!instance) return null;

  const byMilestone = new Map(
    instance.taskCompletions.map((completion) => [completion.milestoneId, completion]),
  );

  const now = new Date();

  const tasks = instance.template.milestones.map((milestone) => {
    const completion = byMilestone.get(milestone.id) ?? null;
    const status = completion?.status ?? 'TODO';
    const dueDate = completion?.dueDate ?? dueDateFor(instance.startDate, milestone.dayOffset);
    const shape = { status, dueDate };

    return {
      completionId: completion?.id ?? null,
      milestoneId: milestone.id,
      dayLabelFr: milestone.dayLabelFr,
      dayOffset: milestone.dayOffset,
      titleFr: milestone.titleFr,
      detailFr: milestone.detailFr,
      isRecommended: milestone.isRecommended,
      phase: milestone.phase,
      ownerDepartment: milestone.ownerDepartment,
      status,
      dueDate,
      completedAt: completion?.completedAt ?? null,
      validatedAt: completion?.validatedAt ?? null,
      noteFr: completion?.noteFr ?? null,
      overdue: isOverdue(shape, now),
      dueSoon: isDueSoon(shape, 3, now),
    };
  });

  return {
    instanceId: instance.id,
    subjectUserId: instance.user.id,
    subjectName: instance.user.displayName,
    templateTitleFr: instance.template.titleFr,
    startDate: instance.startDate,
    tasks,
    progress: progressOf(tasks, now),
  };
}

/** Every journey the caller may see — the manager and direction views. */
export async function loadJourneySummaries(user) {
  const scope = scopeFilterFor(user, 'read', 'onboarding_instance');
  if (scope.kind === 'none') return [];

  const instances = await prisma.onboardingInstance.findMany({
    where:
      scope.kind === 'self'
        ? { userId: user.id }
        : scope.kind === 'units'
          ? {
              user: {
                userRoles: {
                  some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } },
                },
              },
            }
          : {},
    include: {
      user: { select: { id: true, displayName: true } },
      template: {
        select: { titleFr: true, milestones: { select: { id: true, dayOffset: true } } },
      },
      taskCompletions: { select: { status: true, dueDate: true, milestoneId: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const now = new Date();

  return instances.map((instance) => {
    const byMilestone = new Map(
      instance.taskCompletions.map((completion) => [completion.milestoneId, completion]),
    );
    const tasks = instance.template.milestones.map((milestone) => {
      const completion = byMilestone.get(milestone.id);
      return {
        status: completion?.status ?? 'TODO',
        dueDate: completion?.dueDate ?? dueDateFor(instance.startDate, milestone.dayOffset),
      };
    });

    return {
      instanceId: instance.id,
      subjectUserId: instance.user.id,
      subjectName: instance.user.displayName,
      templateTitleFr: instance.template.titleFr,
      startDate: instance.startDate,
      progress: progressOf(tasks, now),
    };
  });
}

/** The instance's subject and their structure — what assertCan/mutate target resolvers need. */
export async function anchorOfInstance(instanceId) {
  const instance = await prisma.onboardingInstance.findUnique({
    where: { id: instanceId },
    select: {
      userId: true,
      user: {
        select: { userRoles: { select: { scope: { select: { organizationUnitId: true } } } } },
      },
    },
  });
  if (!instance) throw Object.assign(new Error('unknown instance'), { status: 404 });

  return {
    ownerUserId: instance.userId,
    organizationUnitId:
      instance.user.userRoles.map((role) => role.scope?.organizationUnitId).find(Boolean) ?? null,
  };
}
