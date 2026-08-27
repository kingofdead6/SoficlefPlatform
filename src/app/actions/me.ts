'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';

/**
 * What a recruit can do on their own surface.
 *
 * Both actions are anchored on the caller: the target names `ownerUserId`, so a SELF-scoped
 * assignment covers the row and nothing else. There is no id in the payload that could
 * point at somebody else's record.
 */

const Acknowledge = z.object({ documentId: z.string().uuid() });

/**
 * Records that somebody has read and accepted a document.
 *
 * Idempotent by construction: the unique index makes a second click a no-op rather than a
 * second acceptance, so "who has accepted" counts people and not clicks.
 */
export async function acknowledgeDocument(
  _previous: ActionResult<{ acknowledged: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ acknowledged: true }>> {
  const result = await mutate(
    { documentId: formData.get('documentId') },
    {
      schema: Acknowledge,
      requires: { resource: 'document', action: 'read' },
      target: (_value, user) => ({ ownerUserId: user.id }),
      run: async (value, context) => {
        const document = await context.tx.document.findUniqueOrThrow({
          where: { id: value.documentId },
          select: { id: true, titleFr: true },
        });

        const existing = await context.tx.documentAcknowledgement.findUnique({
          where: {
            documentId_userId: { documentId: document.id, userId: context.user.id },
          },
          select: { id: true },
        });

        if (!existing) {
          await context.tx.documentAcknowledgement.create({
            data: { documentId: document.id, userId: context.user.id },
          });

          await context.audit({
            action: 'document.downloaded',
            entityType: 'document_acknowledgement',
            entityId: document.id,
            before: null,
            after: { titleFr: document.titleFr, accepted: true },
          });
        }

        return { acknowledged: true as const };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/app/me/documents', 'page');
  return result;
}

const SubmitFile = z.object({
  fileId: z.string().uuid(),
  /**
   * How the paper actually reached HR, since the platform cannot store the bytes yet
   * (OQ-14/OQ-15). Free text rather than an enum: the channels vary, and guessing a fixed
   * list would be inventing business process.
   */
  noteFr: z.string().trim().min(1).max(500),
});

/**
 * Marks a personal file as submitted.
 *
 * Records the declaration, not the file — there is no storage backend yet, and pretending
 * otherwise would leave people believing they had uploaded something that does not exist.
 * HR still reviews and accepts, which is the part of the process that matters.
 */
export async function submitPersonalFile(
  _previous: ActionResult<{ fileId: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ fileId: string }>> {
  const result = await mutate(
    { fileId: formData.get('fileId'), noteFr: formData.get('noteFr') },
    {
      schema: SubmitFile,
      requires: { resource: 'document', action: 'read' },
      target: (_value, user) => ({ ownerUserId: user.id }),
      run: async (value, context) => {
        // Scoped to the caller in the query: a file id belonging to somebody else simply
        // is not found, rather than being found and then refused (ADR-021).
        const file = await context.tx.personalFile.findFirst({
          where: { id: value.fileId, userId: context.user.id },
          select: { id: true, status: true, labelFr: true },
        });
        if (!file) throw Object.assign(new Error('unknown file'), { status: 404 });

        if (file.status === 'ACCEPTED') {
          throw Object.assign(new Error('Cette pièce est déjà validée.'), { status: 409 });
        }

        await context.tx.personalFile.update({
          where: { id: file.id },
          data: { status: 'SUBMITTED', submittedAt: new Date(), noteFr: value.noteFr },
        });

        await context.audit({
          action: 'entity.updated',
          entityType: 'personal_file',
          entityId: file.id,
          before: { status: file.status },
          after: { status: 'SUBMITTED', labelFr: file.labelFr },
        });

        return { fileId: file.id };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/app/me/files', 'page');
  return result;
}
