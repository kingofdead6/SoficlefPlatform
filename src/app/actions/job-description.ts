'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { snapshotFrom } from '@/application/job-description/versions';
import { mutate, type ActionResult } from '@/application/shared/mutate';
import {
  ACTION_PERMISSION,
  transition,
  type JobDescriptionStatus,
  type WorkflowActionKind,
} from '@/domain/workflow/job-description';

/**
 * The job-description validation workflow (CDC v0.1 §6.1, §9).
 *
 * The state machine lives in the domain and is exhaustively tested; this action is the
 * thin server boundary around it. Two §19.1 criteria fall out of that split:
 *
 *   - An illegal transition is a 409 conflict with the reason, never a silent no-op.
 *   - A validated version cannot be edited: a new DRAFT is forked instead, which is what
 *     `createDraft` below does.
 */

const ACTIONS = ['submit', 'approve', 'request_changes', 'archive', 'reopen'] as const;

const ApplyAction = z.object({
  versionId: z.string().uuid(),
  action: z.enum(ACTIONS),
  commentFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function applyWorkflowAction(
  _previous: ActionResult<{ status: JobDescriptionStatus }> | null,
  formData: FormData,
): Promise<ActionResult<{ status: JobDescriptionStatus }>> {
  const requested = String(formData.get('action') ?? '');
  const kind = (ACTIONS as readonly string[]).includes(requested)
    ? (requested as WorkflowActionKind)
    : 'submit';

  const result = await mutate(
    {
      versionId: formData.get('versionId'),
      action: requested,
      commentFr: formData.get('commentFr') ?? '',
    },
    {
      schema: ApplyAction,
      requires: {
        resource: 'job_description',
        // Approving is a different right from submitting; the machine says which.
        action: ACTION_PERMISSION[kind],
      },
      run: async (value, context) => {
        const version = await context.tx.jobDescriptionVersion.findUnique({
          where: { id: value.versionId },
          select: { id: true, status: true, jobDescriptionId: true },
        });
        if (!version) throw Object.assign(new Error('unknown version'), { status: 404 });

        // Throws a 409 when the machine forbids the move; `mutate` maps that to a
        // conflict result the form can render.
        const moved = transition(version.status as JobDescriptionStatus, value.action);

        const validated = moved.to === 'VALIDATED';

        const updated = await context.tx.jobDescriptionVersion.update({
          where: { id: version.id },
          data: {
            status: moved.to,
            validatedAt: validated ? new Date() : null,
            validatedBy: validated ? context.user.id : null,
          },
        });

        await context.tx.workflowAction.create({
          data: {
            entityType: 'job_description_version',
            entityId: version.id,
            action: moved.action,
            fromStatus: moved.from,
            toStatus: moved.to,
            commentFr: value.commentFr ? value.commentFr : null,
            actorId: context.user.id,
          },
        });

        await context.audit({
          action: validated ? 'entity.validated' : 'entity.updated',
          entityType: 'job_description_version',
          entityId: version.id,
          before: { status: moved.from },
          after: { status: moved.to },
        });

        return { status: updated.status as JobDescriptionStatus };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/job-description', 'page');
  return result;
}

const CreateDraft = z.object({
  jobDescriptionId: z.string().uuid(),
  reasonFr: z.string().trim().min(3, 'Indiquez le motif de la nouvelle version.').max(500),
});

/**
 * Forks a new DRAFT from the current content (§19.1).
 *
 * This is how a validated job description is "edited": the validated version stays as it
 * was signed off, and the new draft carries the change. Refused while a version is
 * already open, so two people cannot draft the same document in parallel and silently
 * overwrite each other.
 */
export async function createDraft(
  _previous: ActionResult<{ versionNumber: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ versionNumber: number }>> {
  const result = await mutate(
    {
      jobDescriptionId: formData.get('jobDescriptionId'),
      reasonFr: formData.get('reasonFr') ?? '',
    },
    {
      schema: CreateDraft,
      requires: { resource: 'job_description', action: 'update' },
      run: async (value, context) => {
        const document = await context.tx.jobDescription.findUnique({
          where: { id: value.jobDescriptionId },
          include: {
            missions: { orderBy: { order: 'asc' } },
            permanentTasks: { orderBy: { order: 'asc' } },
            responsibilities: { orderBy: { order: 'asc' } },
            jobDescriptionVersions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          },
        });
        if (!document) throw Object.assign(new Error('unknown job description'), { status: 404 });

        const open = await context.tx.jobDescriptionVersion.count({
          where: {
            jobDescriptionId: value.jobDescriptionId,
            status: { in: ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED'] },
          },
        });
        if (open > 0) {
          throw Object.assign(
            new Error('Une version est déjà en cours de rédaction ou de revue.'),
            { status: 409 },
          );
        }

        const versionNumber = (document.jobDescriptionVersions[0]?.versionNumber ?? 0) + 1;

        const created = await context.tx.jobDescriptionVersion.create({
          data: {
            jobDescriptionId: document.id,
            versionNumber,
            status: 'DRAFT',
            content: snapshotFrom(document),
            reasonFr: value.reasonFr,
            authorId: context.user.id,
          },
        });

        await context.audit({
          action: 'entity.created',
          entityType: 'job_description_version',
          entityId: created.id,
          after: { versionNumber, status: 'DRAFT' },
        });

        return { versionNumber };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/job-description', 'page');
  return result;
}
