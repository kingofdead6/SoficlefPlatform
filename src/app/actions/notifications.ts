'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';

/**
 * The notification centre's write side (CDC v0.1 §9).
 *
 * Marking a notification read is scoped to its recipient by the query itself — the
 * `userId` in the `where` clause is the session's, never the payload's, so one reader
 * cannot clear another's centre even by guessing an id.
 */

const MarkRead = z.object({ id: z.string().uuid().optional() });

export async function markNotificationsRead(
  _previous: ActionResult<{ updated: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ updated: number }>> {
  const raw = formData.get('id');

  const result = await mutate(
    { id: typeof raw === 'string' && raw.length > 0 ? raw : undefined },
    {
      schema: MarkRead,
      requires: { resource: 'notification', action: 'update' },
      target: (_value, user) => ({ ownerUserId: user.id }),
      run: async (value, context) => {
        const { count } = await context.tx.notification.updateMany({
          where: {
            userId: context.user.id,
            readAt: null,
            ...(value.id ? { id: value.id } : {}),
          },
          data: { readAt: new Date() },
        });
        // Deliberately unaudited: reading one's own notification is not a sensitive
        // operation, and an audit row per read would drown the trail that matters.
        return { updated: count };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)', 'layout');
  return result;
}
