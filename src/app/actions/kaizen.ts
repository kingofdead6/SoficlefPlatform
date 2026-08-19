'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';
import { KAIZEN_STATUSES } from '@/domain/kaizen/status';

/**
 * Updating a tracked Kaizen action (CDC v1 §3.5). The permitted status values live in
 * `@/domain/kaizen/status` — see the note there on why they cannot be exported from here.
 */
const UpdateAction = z.object({
  id: z.string().uuid(),
  statusFr: z.enum(KAIZEN_STATUSES),
});

export async function setKaizenActionStatus(
  _previous: ActionResult<{ statusFr: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ statusFr: string }>> {
  const result = await mutate(
    { id: formData.get('id'), statusFr: formData.get('statusFr') },
    {
      schema: UpdateAction,
      requires: { resource: 'kaizen_action', action: 'update' },
      // The Kaizen programme belongs to the Direction de Production as a whole rather
      // than to one structure, so the action carries no unit anchor of its own: a
      // MANAGER holds kaizen_action:update inside their perimeter, and `can()` refuses an
      // unanchored target for a unit-scoped assignment. That is the safe reading — a
      // programme-wide edit is a global-assignment act until the client says otherwise
      // (OQ-09).
      run: async (value, context) => {
        const before = await context.tx.kaizenAction.findUnique({ where: { id: value.id } });
        if (!before) throw Object.assign(new Error('unknown action'), { status: 404 });

        const after = await context.tx.kaizenAction.update({
          where: { id: value.id },
          data: { statusFr: value.statusFr },
        });

        await context.audit({
          action: 'entity.updated',
          entityType: 'kaizen_action',
          entityId: after.id,
          before: { statusFr: before.statusFr },
          after: { statusFr: after.statusFr },
        });

        return { statusFr: after.statusFr };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/kaizen', 'page');
  return result;
}
