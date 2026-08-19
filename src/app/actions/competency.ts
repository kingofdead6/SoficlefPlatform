'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';
import { maxCompetencyLevel } from '@/application/competency/matrix';
import { prisma } from '@/infrastructure/db/client';

/**
 * Recording a competency assessment (CDC v0.1 §7 "Évaluation").
 *
 * An assessment is append-only: a new rating is a new row, never an update of the last
 * one, so the history of how somebody progressed survives — which is what makes the
 * gap chart over time possible and what §16.1 asks for.
 */

const RecordAssessment = z.object({
  competencyId: z.string().uuid(),
  subjectUserId: z.string().uuid(),
  level: z.coerce.number().int().min(0),
  notesFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function recordAssessment(
  _previous: ActionResult<{ level: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ level: number }>> {
  const input = {
    competencyId: formData.get('competencyId'),
    subjectUserId: formData.get('subjectUserId'),
    level: formData.get('level'),
    notesFr: formData.get('notesFr') ?? '',
  };

  const result = await mutate(input, {
    schema: RecordAssessment,
    requires: { resource: 'assessment', action: 'assess' },
    // The subject anchors the check: a manager may assess somebody in their structures,
    // and `SELF` scope covers a self-assessment. Resolved from the database rather than
    // trusted from the payload.
    target: async (value) => {
      const subject = await prisma.user.findUnique({
        where: { id: value.subjectUserId },
        select: {
          id: true,
          userRoles: { select: { scope: { select: { organizationUnitId: true } } } },
        },
      });
      if (!subject) throw Object.assign(new Error('unknown subject'), { status: 404 });

      return {
        ownerUserId: subject.id,
        organizationUnitId:
          subject.userRoles.map((role) => role.scope?.organizationUnitId).find(Boolean) ?? null,
      };
    },
    run: async (value, context) => {
      // The level must exist on the configured scale — a rating of 9 on a 1–4 scale is a
      // bad request, not a stored value nobody can interpret.
      const max = await maxCompetencyLevel();
      if (value.level > max) {
        throw Object.assign(new Error(`level must be between 0 and ${max}`), { status: 409 });
      }

      const created = await context.tx.assessment.create({
        data: {
          competencyId: value.competencyId,
          userId: value.subjectUserId,
          level: value.level,
          assessedBy: context.user.id,
          notesFr: value.notesFr ? value.notesFr : null,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'assessment',
        entityId: created.id,
        after: {
          competencyId: created.competencyId,
          userId: created.userId,
          level: created.level,
        },
      });

      return { level: created.level };
    },
  });

  if (result.ok) revalidatePath('/[locale]/(app)/competencies', 'page');
  return result;
}
