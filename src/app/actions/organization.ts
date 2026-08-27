'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { mutate, type ActionResult } from '@/application/shared/mutate';

/**
 * Organization structures — create, edit, archive (CDC v0.1 §5).
 *
 * §16.1 asks for archival rather than deletion wherever history must survive a
 * reorganization, so nothing here deletes a unit: `archivedAt` is set, the row stays,
 * and every job, assignment and audit entry that referenced it still resolves.
 */

const CODE = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Le code doit être en majuscules, chiffres et tirets.');

const UNIT_TYPES = ['DIRECTION', 'STRUCTURE', 'UNITE_PRODUCTION', 'CELLULE', 'SERVICE'] as const;

const CreateUnit = z.object({
  code: CODE,
  nameFr: z.string().trim().min(2).max(160),
  type: z.enum(UNIT_TYPES),
  parentId: z.string().uuid().nullable(),
  descriptionFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function createOrganizationUnit(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parent = formData.get('parentId');

  const result = await mutate(
    {
      code: formData.get('code'),
      nameFr: formData.get('nameFr'),
      type: formData.get('type'),
      parentId: typeof parent === 'string' && parent.length > 0 ? parent : null,
      descriptionFr: formData.get('descriptionFr') ?? '',
    },
    {
      schema: CreateUnit,
      requires: { resource: 'organization_unit', action: 'create' },
      // A unit-scoped administrator may only create *inside* their own perimeter, so the
      // parent is what the permission is checked against. A root unit (no parent) is
      // therefore reserved to a global assignment, which is the correct reading.
      target: (value) => ({ organizationUnitId: value.parentId }),
      run: async (value, context) => {
        const clash = await context.tx.organizationUnit.findUnique({
          where: { code: value.code },
          select: { id: true },
        });
        if (clash) {
          throw Object.assign(new Error('Ce code est déjà utilisé.'), { status: 409 });
        }

        const created = await context.tx.organizationUnit.create({
          data: {
            code: value.code,
            nameFr: value.nameFr,
            type: value.type,
            parentId: value.parentId,
            descriptionFr: value.descriptionFr ? value.descriptionFr : null,
          },
        });

        await context.audit({
          action: 'entity.created',
          entityType: 'organization_unit',
          entityId: created.id,
          after: created,
        });

        return { id: created.id };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/organization', 'page');
  return result;
}

const EditUnit = z.object({
  id: z.string().uuid(),
  nameFr: z.string().trim().min(2).max(160),
  type: z.enum(UNIT_TYPES),
  descriptionFr: z.string().trim().max(2000).optional().or(z.literal('')),
  headLabelFr: z.string().trim().max(160).optional().or(z.literal('')),
  headOccupancy: z.enum(['VACANT', 'TO_FILL', 'OCCUPIED']).nullable(),
});

export async function editOrganizationUnit(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const occupancy = formData.get('headOccupancy');

  const result = await mutate(
    {
      id: formData.get('id'),
      nameFr: formData.get('nameFr'),
      type: formData.get('type'),
      descriptionFr: formData.get('descriptionFr') ?? '',
      headLabelFr: formData.get('headLabelFr') ?? '',
      headOccupancy: typeof occupancy === 'string' && occupancy.length > 0 ? occupancy : null,
    },
    {
      schema: EditUnit,
      requires: { resource: 'organization_unit', action: 'update' },
      target: (value) => ({ organizationUnitId: value.id }),
      run: async (value, context) => {
        const before = await context.tx.organizationUnit.findUnique({ where: { id: value.id } });
        if (!before) throw Object.assign(new Error('unknown unit'), { status: 404 });

        const after = await context.tx.organizationUnit.update({
          where: { id: value.id },
          data: {
            nameFr: value.nameFr,
            type: value.type,
            descriptionFr: value.descriptionFr ? value.descriptionFr : null,
            headLabelFr: value.headLabelFr ? value.headLabelFr : null,
            headOccupancy: value.headOccupancy,
          },
        });

        await context.audit({
          action: 'entity.updated',
          entityType: 'organization_unit',
          entityId: after.id,
          before,
          after,
        });

        return { id: after.id };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/organization', 'page');
  return result;
}

const ArchiveUnit = z.object({ id: z.string().uuid() });

/**
 * Archives a unit. Refused while anything still hangs off it, because archiving a parent
 * silently would orphan its children in every tree view without deleting a single row —
 * the reorganization has to be done explicitly, child first.
 */
export async function archiveOrganizationUnit(
  _previous: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await mutate(
    { id: formData.get('id') },
    {
      schema: ArchiveUnit,
      requires: { resource: 'organization_unit', action: 'delete' },
      target: (value) => ({ organizationUnitId: value.id }),
      run: async (value, context) => {
        const before = await context.tx.organizationUnit.findUnique({ where: { id: value.id } });
        if (!before) throw Object.assign(new Error('unknown unit'), { status: 404 });

        const children = await context.tx.organizationUnit.count({
          where: { parentId: value.id, archivedAt: null },
        });
        if (children > 0) {
          throw Object.assign(
            new Error('Cette structure porte encore des entités actives. Archivez-les d’abord.'),
            { status: 409 },
          );
        }

        const positions = await context.tx.position.count({
          where: { organizationUnitId: value.id, archivedAt: null },
        });
        if (positions > 0) {
          throw Object.assign(new Error('Des emplois actifs sont rattachés à cette structure.'), {
            status: 409,
          });
        }

        const after = await context.tx.organizationUnit.update({
          where: { id: value.id },
          data: { archivedAt: new Date() },
        });

        await context.audit({
          action: 'entity.deleted',
          entityType: 'organization_unit',
          entityId: after.id,
          before,
          after,
        });

        return { id: after.id };
      },
    },
  );

  if (result.ok) revalidatePath('/[locale]/(app)/organization', 'page');
  return result;
}
