import { z } from 'zod';

import { assertCanAnyScope, scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';
import { mutate } from '../shared/mutate.js';
import { ensureRoundsFor } from '../survey/rounds.js';

/**
 * Assignments — the second half of the provisioning chain (CDC-2026 Module 1).
 * Ported from SoficlefPlatform src/application/organization/assignments.ts, adapted to
 * the Express `mutate(req, input, options)` signature.
 *
 * SI creates an account; HR gives it a post. Neither role can do both, which is the whole
 * point: an account that can actually be used requires two people. The act of assigning is
 * what flips `lifecycleState` to `ASSIGNED`, and what starts the onboarding journey.
 *
 * Assignments are never deleted. Reassigning closes the current row with an end date and
 * opens a new one, because the history is what the turnover reporting reads.
 */

export const AssignInput = z.object({
  userId: z.string().uuid(),
  positionId: z.string().uuid(),
  startDate: z.coerce.date(),
  managerOverrideId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
});

export const EndAssignmentInput = z.object({
  assignmentId: z.string().uuid(),
  endDate: z.coerce.date(),
});

/**
 * Assigns a person to a post. Everything happens in one transaction: closing any open
 * assignment, opening the new one, flipping the lifecycle state, and creating the survey
 * rounds.
 */
export async function assignToPosition(req, input) {
  return mutate(req, input, {
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

      // Close whatever the person holds now.
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
          onboardingStartDate: subject.onboardingStartDate ?? value.startDate,
        },
      });

      /*
       * The onboarding instance and its surveys, when a template was named. Reuses
       * ensureRoundsFor rather than re-deriving the J+7/30/60/90 milestones here.
       *
       * DEVIATION: server/src/application/survey/rounds.js already exists (ported by
       * another agent in this migration), so ensureRoundsFor is imported directly rather
       * than dynamically — no defensive try/catch was needed.
       */
      if (value.templateId) {
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
export async function endAssignment(req, input) {
  return mutate(req, input, {
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

/** Accounts SI has created that HR has not yet placed. The HR work queue. */
export async function listPendingAccounts(user) {
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

/** Requests HR has raised with SI, newest state first and oldest request first within it. */
export async function listAccountRequests(user, limit = 25) {
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
export async function listVacantPositions(user) {
  const scope = scopeFilterFor(user, 'read', 'position');
  if (scope.kind === 'none') return [];

  return prisma.position.findMany({
    where: {
      archivedAt: null,
      assignments: { none: { endDate: null } },
      ...(scope.kind === 'units' ? { organizationUnitId: { in: scope.organizationUnitIds } } : {}),
    },
    select: { id: true, code: true, titleFr: true, occupancyFr: true },
    orderBy: [{ order: 'asc' }, { titleFr: 'asc' }],
  });
}

/** Current assignments, narrowed to what the caller may see. */
export async function listAssignments(user) {
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
