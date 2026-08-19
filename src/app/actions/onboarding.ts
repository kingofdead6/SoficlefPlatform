'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';
import {
  assertTransition,
  isCompleted,
  requiredActionFor,
  type OnboardingTaskStatus,
} from '@/domain/onboarding/task';
import { prisma } from '@/infrastructure/db/client';

/**
 * Moving an onboarding task through §9's states.
 *
 * The permission depends on the destination: ticking a task off needs
 * `onboarding_task:update`, signing it off needs `onboarding_task:validate` — which is
 * why the required action is derived from the payload rather than fixed on the route.
 */

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'VALIDATED'] as const;

const SetTaskStatus = z.object({
  instanceId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
  noteFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

/** The instance's subject and their structure — what `can()` is asked about. */
async function anchorOf(instanceId: string) {
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

export async function setTaskStatus(
  _previous: ActionResult<{ status: OnboardingTaskStatus }> | null,
  formData: FormData,
): Promise<ActionResult<{ status: OnboardingTaskStatus }>> {
  const requested = String(formData.get('status') ?? '');

  const result = await mutate(
    {
      instanceId: formData.get('instanceId'),
      milestoneId: formData.get('milestoneId'),
      status: requested,
      noteFr: formData.get('noteFr') ?? '',
    },
    {
      schema: SetTaskStatus,
      requires: {
        resource: 'onboarding_task',
        // A sign-off is a different permission from ticking a box.
        action: requiredActionFor(
          (TASK_STATUSES as readonly string[]).includes(requested)
            ? (requested as OnboardingTaskStatus)
            : 'TODO',
        ),
      },
      target: (value) => anchorOf(value.instanceId),
      run: async (value, context) => {
        const existing = await context.tx.onboardingTaskCompletion.findUnique({
          where: {
            instanceId_milestoneId: {
              instanceId: value.instanceId,
              milestoneId: value.milestoneId,
            },
          },
        });

        const from = (existing?.status ?? 'TODO') as OnboardingTaskStatus;
        // Throws 409 on an illegal move; `mutate` turns that into a conflict result.
        assertTransition(from, value.status);

        const completed = isCompleted(value.status);
        const validated = value.status === 'VALIDATED';

        const data = {
          status: value.status,
          completedAt: completed ? (existing?.completedAt ?? new Date()) : null,
          completedBy: completed ? (existing?.completedBy ?? context.user.id) : null,
          validatedAt: validated ? new Date() : null,
          validatedBy: validated ? context.user.id : null,
          noteFr: value.noteFr ? value.noteFr : (existing?.noteFr ?? null),
        };

        const saved = existing
          ? await context.tx.onboardingTaskCompletion.update({
              where: { id: existing.id },
              data,
            })
          : await context.tx.onboardingTaskCompletion.create({
              data: { instanceId: value.instanceId, milestoneId: value.milestoneId, ...data },
            });

        await context.audit({
          action: validated ? 'entity.validated' : 'entity.updated',
          entityType: 'onboarding_task',
          entityId: saved.id,
          before: existing ? { status: from } : null,
          after: { status: saved.status },
        });

        // Tell the collaborator their step was signed off — §9 makes in-app
        // notifications mandatory. Never notify somebody about their own action.
        if (validated) {
          const instance = await context.tx.onboardingInstance.findUnique({
            where: { id: value.instanceId },
            select: { userId: true },
          });
          const milestone = await context.tx.onboardingMilestone.findUnique({
            where: { id: value.milestoneId },
            select: { titleFr: true },
          });

          if (instance && instance.userId !== context.user.id) {
            await context.tx.notification.create({
              data: {
                userId: instance.userId,
                kind: 'onboarding.task.validated',
                titleFr: 'Étape validée',
                bodyFr: milestone
                  ? `${context.user.displayName} a validé « ${milestone.titleFr} ».`
                  : null,
                href: '/onboarding',
              },
            });
          }
        }

        return { status: saved.status as OnboardingTaskStatus };
      },
    },
  );

  if (result.ok) {
    revalidatePath('/[locale]/(app)/onboarding', 'page');
    revalidatePath('/[locale]/(app)', 'layout');
  }
  return result;
}
