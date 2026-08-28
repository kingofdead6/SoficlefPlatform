import 'server-only';

import { z } from 'zod';

import type { ActionResult } from '@/application/shared/mutate';
import { mutate } from '@/application/shared/mutate';
import { ensureRoundsFor } from '@/application/survey/rounds';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { assertCanAnyScope, scopeFilterFor } from '@/domain/auth/authorization';
import { prisma } from '@/infrastructure/db/client';

/**
 * Assignments — the second half of the provisioning chain (CDC-2026 Module 1).
 *
 * SI creates an account; HR gives it a post. Neither role can do both, which is the whole
 * point: an account that can actually be used requires two people. The act of assigning is
 * what flips `lifecycleState` to `ASSIGNED`, and what starts the onboarding journey.
 *
 * Assignments are never deleted. Reassigning closes the current row with an end date and
 * opens a new one, because the history is what the turnover reporting reads, and because
 * "who held this post in March" must stay answerable.
 */

export const AssignInput = z.object({
  userId: z.string().uuid(),
  positionId: z.string().uuid(),
  startDate: z.coerce.date(),
  /** When the reporting line differs from the position tree — a secondment. */
  managerOverrideId: z.string().uuid().nullable().optional(),
  /** The onboarding template to run, when one applies. */
  templateId: z.string().uuid().nullable().optional(),
});

export const EndAssignmentInput = z.object({
  assignmentId: z.string().uuid(),
  endDate: z.coerce.date(),
});

export interface AssignmentView {
  id: string;
  startDate: Date;
  endDate: Date | null;
  user: { id: string; displayName: string; email: string };
  position: { id: string; titleFr: string; code: string };
}

/**
 * Assigns a person to a post.
 *
 * Everything happens in one transaction: closing any open assignment, opening the new
 * one, flipping the lifecycle state, and creating the survey rounds. A half-applied
 * assignment would leave an account that is `ASSIGNED` with nowhere to be, or a journey
 * with no surveys — both worse than a clean failure.
 */
export async function assignToPosition(
  input: unknown,
): Promise<ActionResult<{ assignmentId: string }>> {
  return mutate(input, {
    schema: AssignInput,
    requires: { resource: 'assignment', action: 'create' },
    // The assignment is anchored where the post is, so a unit-scoped HR role can only
    // place people into its own structures.
    target: async (value) => {
      const position = await prisma.position.findUniqueOrThrow({
        where: { id: value.positionId },
        select: { organizationUnitId: true },
      });
      return { organizationUnitId: position.organizationUnitId };
    },
    run: async (value, context) => {
      const subject = await context.tx.user.findUniqueOrThrow({
        where: { id: value.userId },
        select: { id: true, displayName: true, lifecycleState: true, onboardingStartDate: true },
      });

      // Close whatever the person holds now. The partial unique index would refuse a
      // second open row anyway; doing it explicitly makes the history correct rather than
      // just making the insert succeed.
      const open = await context.tx.assignment.findFirst({
        where: { userId: value.userId, endDate: null },
        select: { id: true, positionId: true },
      });

      if (open) {
        if (open.positionId === value.positionId) {
          throw Object.assign(new Error('Cette personne occupe déjà ce poste.'), { status: 409 });
        }
        await context.tx.assignment.update({
          where: { id: open.id },
          data: { endDate: value.startDate },
        });
        await context.tx.position.update({
          where: { id: open.positionId },
          data: { isVacant: true, occupancy: 'VACANT' },
        });
      }

      const created = await context.tx.assignment.create({
        data: {
          userId: value.userId,
          positionId: value.positionId,
          startDate: value.startDate,
          managerOverrideId: value.managerOverrideId ?? null,
          templateId: value.templateId ?? null,
        },
        select: { id: true },
      });

      await context.tx.position.update({
        where: { id: value.positionId },
        data: { isVacant: false, occupancy: 'OCCUPIED', occupancyFr: null },
      });

      await context.tx.user.update({
        where: { id: value.userId },
        data: {
          lifecycleState: 'ASSIGNED',
          // The journey starts when the post does, unless one was already under way.
          onboardingStartDate: subject.onboardingStartDate ?? value.startDate,
        },
      });

      /*
       * The onboarding instance and its surveys, when a template was named. Reuses
       * `ensureRoundsFor` rather than re-deriving the J+7/30/60/90 milestones here —
       * two places computing the same dates is two places to get them wrong.
       */
      if (value.templateId) {
        /*
         * A *new* journey, not an edit of the old one. `OnboardingInstance` is
         * deliberately one-per-journey rather than one-per-person: somebody who changes
         * post is onboarded again, and each journey keeps its own probation outcome. An
         * unfinished previous journey is reused rather than duplicated, though — two open
         * journeys for one person is a data error, not a second onboarding.
         */
        const running = await context.tx.onboardingInstance.findFirst({
          where: { userId: value.userId, completedAt: null },
          select: { id: true },
        });

        const instance = running
          ? await context.tx.onboardingInstance.update({
              where: { id: running.id },
              data: { templateId: value.templateId, startDate: value.startDate },
              select: { id: true },
            })
          : await context.tx.onboardingInstance.create({
              data: {
                userId: value.userId,
                templateId: value.templateId,
                startDate: value.startDate,
              },
              select: { id: true },
            });

        await ensureRoundsFor(instance.id, value.startDate, context.tx);
      }

      await context.audit({
        action: 'user.assigned',
        entityType: 'assignment',
        entityId: created.id,
        before: { lifecycleState: subject.lifecycleState, assignmentId: open?.id ?? null },
        after: { lifecycleState: 'ASSIGNED', positionId: value.positionId },
      });

      return { assignmentId: created.id };
    },
  });
}

/** Closes an assignment. The row stays; only its end date is written. */
export async function endAssignment(input: unknown): Promise<ActionResult<{ assignmentId: string }>> {
  return mutate(input, {
    schema: EndAssignmentInput,
    requires: { resource: 'assignment', action: 'update' },
    target: async (value) => {
      const assignment = await prisma.assignment.findUniqueOrThrow({
        where: { id: value.assignmentId },
        select: { position: { select: { organizationUnitId: true } } },
      });
      return { organizationUnitId: assignment.position.organizationUnitId };
    },
    run: async (value, context) => {
      const before = await context.tx.assignment.findUniqueOrThrow({
        where: { id: value.assignmentId },
        select: { id: true, userId: true, positionId: true, endDate: true, startDate: true },
      });

      if (before.endDate) {
        throw Object.assign(new Error('Cette affectation est déjà close.'), { status: 409 });
      }
      if (value.endDate < before.startDate) {
        throw Object.assign(new Error('La fin ne peut pas précéder le début.'), { status: 422 });
      }

      await context.tx.assignment.update({
        where: { id: value.assignmentId },
        data: { endDate: value.endDate },
      });

      await context.tx.position.update({
        where: { id: before.positionId },
        data: { isVacant: true, occupancy: 'VACANT' },
      });

      /*
       * The account keeps its `ACTIVE` status but loses its placement, so it returns to
       * the pending state rather than being disabled. Somebody between two posts is not
       * somebody whose account should stop working — that is what `UserStatus` is for,
       * and it is a different decision with a different owner.
       */
      await context.tx.user.update({
        where: { id: before.userId },
        data: { lifecycleState: 'PENDING_ASSIGNMENT' },
      });

      await context.audit({
        action: 'user.assignment_ended',
        entityType: 'assignment',
        entityId: before.id,
        before: { endDate: null },
        after: { endDate: value.endDate },
      });

      return { assignmentId: before.id };
    },
  });
}

/**
 * Accounts SI has created that HR has not yet placed. The HR work queue.
 *
 * `waitingDays` is computed here rather than in the page: a duration depends on when it is
 * measured, and a component that reads the clock mid-render can disagree with itself
 * between passes. Oldest first, so nobody sits in the queue because their name sorts late.
 */
export async function listPendingAccounts(
  user: AuthenticatedUser,
): Promise<
  { id: string; displayName: string; email: string; createdAt: Date; waitingDays: number }[]
> {
  assertCanAnyScope(user, 'read', 'assignment');

  const rows = await prisma.user.findMany({
    where: { lifecycleState: 'PENDING_ASSIGNMENT', status: 'ACTIVE' },
    select: { id: true, displayName: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const now = Date.now();
  return rows.map((row) => ({
    ...row,
    waitingDays: Math.floor((now - row.createdAt.getTime()) / 86_400_000),
  }));
}

/**
 * Requests HR has raised with SI, newest state first and oldest request first within it.
 *
 * `waitingDays` is attached here for the same reason as on the pending queue: a duration
 * is a property of the data at the moment it was read, not of the markup.
 */
export async function listAccountRequests(
  user: AuthenticatedUser,
  limit = 25,
): Promise<
  {
    id: string;
    candidateNameFr: string;
    plannedPositionFr: string;
    plannedHireDate: Date | null;
    urgency: string;
    status: string;
    createdAt: Date;
    waitingDays: number;
  }[]
> {
  assertCanAnyScope(user, 'read', 'assignment');

  const rows = await prisma.accountRequest.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    select: {
      id: true,
      candidateNameFr: true,
      plannedPositionFr: true,
      plannedHireDate: true,
      urgency: true,
      status: true,
      createdAt: true,
    },
  });

  const now = Date.now();
  return rows.map((row) => ({
    ...row,
    waitingDays: Math.floor((now - row.createdAt.getTime()) / 86_400_000),
  }));
}

/** Posts nobody currently holds, for the assignment form. */
export async function listVacantPositions(
  user: AuthenticatedUser,
): Promise<{ id: string; code: string; titleFr: string; occupancyFr: string | null }[]> {
  const scope = scopeFilterFor(user, 'read', 'position');
  if (scope.kind === 'none') return [];

  return prisma.position.findMany({
    where: {
      archivedAt: null,
      assignments: { none: { endDate: null } },
      ...(scope.kind === 'units'
        ? { organizationUnitId: { in: scope.organizationUnitIds } }
        : {}),
    },
    select: { id: true, code: true, titleFr: true, occupancyFr: true },
    orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
  });
}

/** Current assignments, narrowed to what the caller may see. */
export async function listAssignments(user: AuthenticatedUser): Promise<AssignmentView[]> {
  const scope = scopeFilterFor(user, 'read', 'assignment');
  if (scope.kind === 'none') return [];

  return prisma.assignment.findMany({
    where: {
      endDate: null,
      ...(scope.kind === 'units'
        ? { position: { organizationUnitId: { in: scope.organizationUnitIds } } }
        : scope.kind === 'self'
          ? { userId: user.id }
          : {}),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      user: { select: { id: true, displayName: true, email: true } },
      position: { select: { id: true, titleFr: true, code: true } },
    },
    orderBy: { startDate: 'desc' },
  });
}
