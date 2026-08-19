'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';
import { prisma } from '@/infrastructure/db/client';

/**
 * The remarks journal (CDC v1 §3.7).
 *
 * A remark is the collaborator's own observation to HR and the DG. The author is taken
 * from the session, never from the payload, so a remark cannot be filed in somebody
 * else's name.
 */

const AddRemark = z.object({
  contentFr: z.string().trim().min(1, 'La remarque ne peut pas être vide.').max(5000),
});

export async function addRemark(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await mutate(
    { contentFr: formData.get('contentFr') ?? '' },
    {
      schema: AddRemark,
      requires: { resource: 'remark', action: 'create' },
      // Self-scoped: the author writes their own journal entry, so the target names
      // them — a SELF assignment covers no other row.
      target: (_value, user) => ({ ownerUserId: user.id }),
      run: async (value, context) => {
        const created = await context.tx.remark.create({
          data: { authorId: context.user.id, contentFr: value.contentFr },
        });

        await context.audit({
          action: 'entity.created',
          entityType: 'remark',
          entityId: created.id,
          after: { authorId: created.authorId },
        });

        return { id: created.id };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/remarks', 'page');
  return result;
}

const DeleteRemark = z.object({ id: z.string().uuid() });

export async function deleteRemark(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await mutate(
    { id: formData.get('id') },
    {
      schema: DeleteRemark,
      requires: { resource: 'remark', action: 'delete' },
      // Only the author may withdraw their own remark: the target names them, and
      // `can()` refuses a SELF-scoped assignment against anybody else's row.
      target: async (value) => {
        const remark = await prisma.remark.findUnique({
          where: { id: value.id },
          select: { authorId: true },
        });
        if (!remark) throw Object.assign(new Error('unknown remark'), { status: 404 });
        return { ownerUserId: remark.authorId };
      },
      run: async (value, context) => {
        const existing = await context.tx.remark.findUnique({ where: { id: value.id } });
        if (!existing) throw Object.assign(new Error('unknown remark'), { status: 404 });

        // Belt and braces: `can()` has already refused a non-author, but the ownership
        // rule is restated where the row is actually deleted.
        if (existing.authorId !== context.user.id) {
          throw Object.assign(new Error('not the author'), { status: 403 });
        }

        await context.tx.remark.delete({ where: { id: value.id } });
        await context.audit({
          action: 'entity.deleted',
          entityType: 'remark',
          entityId: value.id,
          before: { authorId: existing.authorId },
        });

        return { id: value.id };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/remarks', 'page');
  return result;
}
