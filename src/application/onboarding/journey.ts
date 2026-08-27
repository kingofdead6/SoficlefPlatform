import 'server-only';

import { scopeFilterFor, type AuthenticatedUser } from '@/domain/auth/authorization';
import {
  dueDateFor,
  isDueSoon,
  isOverdue,
  progressOf,
  type OnboardingProgress,
  type OnboardingTaskStatus,
} from '@/domain/onboarding/task';
import { prisma } from '@/infrastructure/db/client';

/**
 * Reads an onboarding journey with its tasks, deadlines and progress (CDC v0.1 §8).
 *
 * A milestone with no completion row yet is still a task: the journey is the template's
 * milestones, left-joined onto whatever progress exists, so a template gaining a
 * milestone after instantiation does not leave a hole in somebody's checklist.
 */

export interface JourneyTask {
  /** The completion row's id, or null when the milestone has no progress row yet. */
  completionId: string | null;
  milestoneId: string;
  dayLabelFr: string;
  dayOffset: number;
  titleFr: string;
  detailFr: string;
  isRecommended: boolean;
  /**
   * Which of CDC-2026 §2's three phases the task belongs to, and which department owns it.
   *
   * Both are nullable because the seeded template predates the columns. A task with no
   * phase is grouped under the probation period, which is where an undated task in a
   * 90-day journey actually sits; a task with no owner shows no department rather than
   * guessing one.
   */
  phase: 'PRE_ONBOARDING' | 'DAY_ONE' | 'PROBATION' | null;
  ownerDepartment: 'HR' | 'IT' | 'HSE' | 'QUALITY' | 'MANAGER' | 'EMPLOYEE' | null;
  status: OnboardingTaskStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  validatedAt: Date | null;
  noteFr: string | null;
  overdue: boolean;
  dueSoon: boolean;
}

export interface Journey {
  instanceId: string;
  subjectUserId: string;
  subjectName: string;
  templateTitleFr: string;
  startDate: Date;
  tasks: JourneyTask[];
  progress: OnboardingProgress;
}

/** The journey of one person, or the caller's own when no subject is given. */
export async function loadJourney(
  user: AuthenticatedUser,
  options: { subjectUserId?: string; instanceId?: string } = {},
): Promise<Journey | null> {
  const scope = scopeFilterFor(user, 'read', 'onboarding_task');
  if (scope.kind === 'none') return null;

  // `self` scope may only ever read its own journey, whatever id was asked for — the
  // restriction is applied to the query rather than checked afterwards (ADR-021).
  const subjectUserId = scope.kind === 'self' ? user.id : (options.subjectUserId ?? user.id);

  /*
   * A unit-scoped reader may only reach a subject inside their perimeter.
   *
   * This predicate was missing: `subjectUserId` was taken from the caller's options and
   * used unqualified, so a manager who knew another person's id could read a journey from
   * a sibling structure. `loadJourneySummaries` below always had the predicate; this
   * function is brought into line with it.
   *
   * Reading their own journey stays possible either way — a manager is somebody's
   * collaborator too, and their own row is matched by `userId` regardless of unit.
   */
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

  const tasks: JourneyTask[] = instance.template.milestones.map((milestone) => {
    const completion = byMilestone.get(milestone.id) ?? null;
    const status = (completion?.status ?? 'TODO') as OnboardingTaskStatus;
    // Fall back to the milestone's own offset when the row carries no explicit deadline,
    // so a journey seeded before due dates existed still reports lateness.
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

/** Every journey the caller may see — the manager and direction views of §8.1. */
export async function loadJourneySummaries(user: AuthenticatedUser) {
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
        status: (completion?.status ?? 'TODO') as OnboardingTaskStatus,
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
