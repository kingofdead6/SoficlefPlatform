import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import {
  descendantUnitIds,
  findOrganizationUnitForUser,
  listOrganizationUnits,
  updateOrganizationUnit,
} from '../infrastructure/repositories/organization-unit-repository.js';

const router = Router();
router.use(requireAuth);

function ipFromReq(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? null;
}

/**
 * GET /api/v1/organization-units — ported from app/api/v1/organization-units/route.ts.
 * The scope predicate is applied in the query (scopeFilterFor), so this handler does
 * no filtering of its own to forget.
 */
router.get('/', async (req, res, next) => {
  try {
    const units = await listOrganizationUnits(req.user);
    res.json({ data: units });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const unit = await findOrganizationUnitForUser(req.user, req.params.id);
    if (!unit) return res.status(404).json({ error: 'not-found' });
    res.json({ data: unit });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const unit = await updateOrganizationUnit(req.user, req.params.id, req.body, {
      ip: ipFromReq(req),
      userAgent: req.headers['user-agent'] ?? null,
    });
    res.json({ data: unit });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/* =========================================================================================
 * Structural editing (route guide §2.4, /admin/organization).
 *
 * The reads above are scoped per user; the three mutations below are the administrator's
 * skeleton work — creating a unit, retiring one, and folding one into another — and go
 * through mutate() so each is validated, authorized against the unit's own scope, audited
 * and transactional.
 *
 * Archiving and merging both refuse rather than cascade. A unit with live children or
 * positions beneath it is not a leaf an administrator can quietly retire: the refusal names
 * what is in the way so the fix is obvious, instead of silently orphaning a branch.
 * ========================================================================================= */

const CreateUnit = z.object({
  code: z.string().trim().min(2).max(64),
  nameFr: z.string().trim().min(2).max(160),
  type: z.string().trim().min(2).max(40),
  parentId: z.string().uuid().nullable().optional(),
  descriptionFr: z.string().trim().max(2000).nullable().optional(),
});

router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateUnit,
    requires: { resource: 'organization_unit', action: 'create' },
    // Authorized against the parent: creating a child of a unit is an act within that
    // unit's scope. A root unit (no parent) requires a global grant, which is what
    // scopeCovers() returns for an undefined organizationUnitId.
    target: (value) => ({ organizationUnitId: value.parentId ?? undefined }),
    run: async (value, context) => {
      const clash = await context.tx.organizationUnit.findUnique({
        where: { code: value.code },
        select: { id: true },
      });
      if (clash) throw Object.assign(new Error('Ce code est déjà utilisé.'), { status: 409 });

      if (value.parentId) {
        const parent = await context.tx.organizationUnit.findUnique({
          where: { id: value.parentId },
          select: { id: true, archivedAt: true },
        });
        if (!parent) throw Object.assign(new Error('unknown parent unit'), { status: 404 });
        if (parent.archivedAt) {
          throw Object.assign(new Error('L’unité parente est archivée.'), { status: 409 });
        }
      }

      const created = await context.tx.organizationUnit.create({
        data: {
          code: value.code,
          nameFr: value.nameFr,
          type: value.type,
          parentId: value.parentId ?? null,
          descriptionFr: value.descriptionFr ?? null,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'organization_unit',
        entityId: created.id,
        after: created,
      });

      return { id: created.id, code: created.code, nameFr: created.nameFr };
    },
  });

  sendActionResult(res, result, 201);
});

router.delete('/:id', async (req, res) => {
  const result = await mutate(req, {}, {
    schema: z.object({}),
    requires: { resource: 'organization_unit', action: 'delete' },
    target: () => ({ organizationUnitId: req.params.id }),
    run: async (_value, context) => {
      const before = await context.tx.organizationUnit.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown unit'), { status: 404 });
      if (before.archivedAt) {
        throw Object.assign(new Error('Cette unité est déjà archivée.'), { status: 409 });
      }

      const [children, positions] = await Promise.all([
        context.tx.organizationUnit.count({ where: { parentId: req.params.id, archivedAt: null } }),
        context.tx.position.count({ where: { organizationUnitId: req.params.id, archivedAt: null } }),
      ]);

      if (children > 0 || positions > 0) {
        const reasons = [
          children > 0 ? `${children} unité(s) rattachée(s)` : null,
          positions > 0 ? `${positions} poste(s) actif(s)` : null,
        ].filter(Boolean);
        throw Object.assign(
          new Error(
            `Impossible d’archiver : cette unité contient encore ${reasons.join(' et ')}. Déplacez-les ou fusionnez l’unité dans une autre.`,
          ),
          { status: 409 },
        );
      }

      const after = await context.tx.organizationUnit.update({
        where: { id: req.params.id },
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
  });

  sendActionResult(res, result);
});

const MergeUnit = z.object({ targetUnitId: z.string().uuid() });

/**
 * POST /:id/merge — folds the source unit into the target: every child unit, position and
 * permission scope moves across, then the source is archived. One transaction, one audit
 * row, so a half-merged tree is not a state the database can be left in.
 *
 * Refused when the target is the source itself or one of its descendants: re-parenting a
 * subtree under a node inside that same subtree detaches it from the tree entirely, and a
 * cycle in `parentId` makes the recursive CTE in descendantUnitIds() non-terminating.
 */
router.post('/:id/merge', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: MergeUnit,
    requires: { resource: 'organization_unit', action: 'update' },
    target: () => ({ organizationUnitId: req.params.id }),
    run: async (value, context) => {
      const sourceId = req.params.id;
      const targetId = value.targetUnitId;

      if (sourceId === targetId) {
        throw Object.assign(new Error('Une unité ne peut pas être fusionnée avec elle-même.'), {
          status: 409,
        });
      }

      const [source, target] = await Promise.all([
        context.tx.organizationUnit.findUnique({ where: { id: sourceId } }),
        context.tx.organizationUnit.findUnique({ where: { id: targetId } }),
      ]);
      if (!source || !target) throw Object.assign(new Error('unknown unit'), { status: 404 });
      if (source.archivedAt) {
        throw Object.assign(new Error('L’unité source est déjà archivée.'), { status: 409 });
      }
      if (target.archivedAt) {
        throw Object.assign(new Error('L’unité cible est archivée.'), { status: 409 });
      }

      const descendants = await descendantUnitIds([sourceId]);
      if (descendants.includes(targetId)) {
        throw Object.assign(
          new Error(
            'Impossible de fusionner une unité dans une unité qui lui est rattachée : la branche se détacherait de l’organigramme.',
          ),
          { status: 409 },
        );
      }

      const movedChildren = await context.tx.organizationUnit.updateMany({
        where: { parentId: sourceId },
        data: { parentId: targetId },
      });

      const movedPositions = await context.tx.position.updateMany({
        where: { organizationUnitId: sourceId },
        data: { organizationUnitId: targetId },
      });

      /*
       * Scopes carry a unique (type, organizationUnitId), so they cannot simply be
       * repointed: if the target already owns a scope of the same type the update would
       * violate that constraint. Where a twin exists the role grants are moved onto it and
       * the now-empty source scope is dropped; where none exists the row is repointed.
       * Either way every user keeps the grant, expressed against the surviving unit.
       */
      const sourceScopes = await context.tx.scope.findMany({
        where: { organizationUnitId: sourceId },
        select: { id: true, type: true },
      });

      let movedScopes = 0;
      for (const scope of sourceScopes) {
        const twin = await context.tx.scope.findFirst({
          where: { type: scope.type, organizationUnitId: targetId },
          select: { id: true },
        });

        if (twin) {
          await context.tx.userRole.updateMany({
            where: { scopeId: scope.id },
            data: { scopeId: twin.id },
          });
          await context.tx.scope.delete({ where: { id: scope.id } });
        } else {
          await context.tx.scope.update({
            where: { id: scope.id },
            data: { organizationUnitId: targetId },
          });
        }
        movedScopes += 1;
      }

      const archived = await context.tx.organizationUnit.update({
        where: { id: sourceId },
        data: { archivedAt: new Date(), parentId: targetId },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'organization_unit',
        entityId: sourceId,
        before: source,
        after: {
          mergedIntoId: targetId,
          mergedIntoCode: target.code,
          archivedAt: archived.archivedAt,
          movedChildren: movedChildren.count,
          movedPositions: movedPositions.count,
          movedScopes,
        },
      });

      return {
        sourceId,
        targetId,
        movedChildren: movedChildren.count,
        movedPositions: movedPositions.count,
        movedScopes,
      };
    },
  });

  sendActionResult(res, result);
});

export default router;
