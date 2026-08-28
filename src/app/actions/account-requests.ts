'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';

/**
 * HR asking SI to create an account — the first hop of the provisioning chain.
 *
 * HR deliberately holds no `user:create`, so this records a request rather than creating
 * anything. Making it a row instead of an e-mail is the whole point: a request can then be
 * counted, sorted by age, and chased when it sits too long.
 */

const RequestAccount = z.object({
  candidateNameFr: z.string().trim().min(2).max(120),
  plannedPositionFr: z.string().trim().min(2).max(120),
  plannedHireDate: z.coerce.date().nullable().optional(),
  urgency: z.enum(['NORMAL', 'URGENT']),
  noteFr: z.string().trim().max(1000).optional(),
});

export async function requestAccount(
  _previous: ActionResult<{ requestId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ requestId: string }>> {
  const hireDate = formData.get('plannedHireDate');

  const result = await mutate(
    {
      candidateNameFr: formData.get('candidateNameFr'),
      plannedPositionFr: formData.get('plannedPositionFr'),
      plannedHireDate: typeof hireDate === 'string' && hireDate ? hireDate : null,
      urgency: formData.get('urgency') ?? 'NORMAL',
      noteFr: formData.get('noteFr') ?? undefined,
    },
    {
      schema: RequestAccount,
      /*
       * Gated on `assignment:create` — the permission that defines HR — rather than on
       * `user:create`, which HR must never hold. Asking for an account and creating one
       * are different acts with different owners, and this is the asking half.
       */
      requires: { resource: 'assignment', action: 'create' },
      run: async (value, context) => {
        const created = await context.tx.accountRequest.create({
          data: {
            candidateNameFr: value.candidateNameFr,
            plannedPositionFr: value.plannedPositionFr,
            plannedHireDate: value.plannedHireDate ?? null,
            urgency: value.urgency,
            noteFr: value.noteFr ?? null,
            requestedById: context.user.id,
          },
          select: { id: true },
        });

        await context.audit({
          action: 'entity.created',
          entityType: 'account_request',
          entityId: created.id,
          before: null,
          after: {
            candidateNameFr: value.candidateNameFr,
            plannedPositionFr: value.plannedPositionFr,
            urgency: value.urgency,
          },
        });

        return { requestId: created.id };
      },
    },
  );

  if (result.ok) {
    revalidatePath('/[locale]/app/hr/employees/request', 'page');
    revalidatePath('/[locale]/app/hr', 'page');
  }

  return result;
}
