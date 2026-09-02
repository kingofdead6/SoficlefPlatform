import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../infrastructure/db/client.js';
import { requireAuth } from '../infrastructure/middleware/auth.js';
import {
  findPositionForUser,
  getVisibleTree,
  listPositionsForUser,
} from '../infrastructure/repositories/position-repository.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

const router = Router();
router.use(requireAuth);

/**
 * Positions (the org chart's posts) and the tree the caller may see.
 * position-repository.js applies the visibility rule (ADR-021); this route layer adds
 * CRUD, ported in the same shape as organization-units.routes.js and
 * app/actions/organization.ts (no dedicated position actions existed in the source app,
 * so this CRUD is modelled directly on organization_unit's create/edit/archive triad).
 */

router.get('/', async (req, res, next) => {
  try {
    const positions = await listPositionsForUser(req.user);
    res.json({ data: positions });
  } catch (error) {
    next(error);
  }
});

router.get('/tree', async (req, res, next) => {
  try {
    const nodes = await getVisibleTree(req.user);
    res.json({ data: nodes });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const position = await findPositionForUser(req.user, req.params.id);
    if (!position) return res.status(404).json({ error: 'not-found' });
    res.json({ data: position });
  } catch (error) {
    next(error);
  }
});

const CreatePosition = z.object({
  code: z.string().trim().min(2).max(64),
  titleFr: z.string().trim().min(2).max(160),
  missionFr: z.string().trim().max(2000).nullable().optional(),
  organizationUnitId: z.string().uuid().nullable(),
  parentPositionId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional().default(0),
});

router.post('/', async (req, res, next) => {
  const result = await mutate(req, req.body, {
    schema: CreatePosition,
    requires: { resource: 'position', action: 'create' },
    target: (value) => ({ organizationUnitId: value.organizationUnitId }),
    run: async (value, context) => {
      const clash = await context.tx.position.findUnique({ where: { code: value.code }, select: { id: true } });
      if (clash) throw Object.assign(new Error('Ce code est déjà utilisé.'), { status: 409 });

      const created = await context.tx.position.create({
        data: {
          code: value.code,
          titleFr: value.titleFr,
          missionFr: value.missionFr ?? null,
          organizationUnitId: value.organizationUnitId,
          parentPositionId: value.parentPositionId ?? null,
          order: value.order ?? 0,
          isVacant: true,
          occupancy: 'VACANT',
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'position',
        entityId: created.id,
        after: created,
      });

      return { id: created.id };
    },
  });
  sendActionResult(res, result, 201);
});

const UpdatePosition = z.object({
  titleFr: z.string().trim().min(2).max(160),
  missionFr: z.string().trim().max(2000).nullable().optional(),
  parentPositionId: z.string().uuid().nullable().optional(),
  order: z.number().int().optional(),
});

router.patch('/:id', async (req, res, next) => {
  const result = await mutate(req, req.body, {
    schema: UpdatePosition,
    requires: { resource: 'position', action: 'update' },
    target: async () => {
      const position = await prisma.position.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { organizationUnitId: true },
      });
      return { organizationUnitId: position.organizationUnitId };
    },
    run: async (value, context) => {
      const before = await context.tx.position.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown position'), { status: 404 });

      const after = await context.tx.position.update({
        where: { id: req.params.id },
        data: {
          titleFr: value.titleFr,
          missionFr: value.missionFr ?? null,
          parentPositionId: value.parentPositionId ?? null,
          ...(value.order !== undefined ? { order: value.order } : {}),
        },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'position',
        entityId: after.id,
        before,
        after,
      });

      return { id: after.id };
    },
  });
  sendActionResult(res, result);
});

const Reparent = z.object({ parentPositionId: z.string().uuid().nullable() });

/**
 * PATCH /:id/parent — moves a post under a new superior (route guide §2.4: "set
 * parent_position_id"). Separate from PATCH /:id because reparenting is the one edit that
 * can corrupt the chart rather than merely change a label, and it carries the cycle guard.
 *
 * The walk is upward from the proposed parent: if the post being moved is reached, the
 * move would place a node under its own descendant, detaching that whole branch from every
 * root and leaving getVisibleTree()'s traversal circling. `seen` bounds the walk so an
 * already-corrupt chain cannot spin here either.
 */
router.patch('/:id/parent', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: Reparent,
    requires: { resource: 'position', action: 'update' },
    target: async () => {
      const position = await prisma.position.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { organizationUnitId: true },
      });
      return { organizationUnitId: position.organizationUnitId };
    },
    run: async (value, context) => {
      const before = await context.tx.position.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown position'), { status: 404 });

      if (value.parentPositionId === req.params.id) {
        throw Object.assign(new Error('Un poste ne peut pas être rattaché à lui-même.'), {
          status: 409,
        });
      }

      if (value.parentPositionId) {
        const proposed = await context.tx.position.findUnique({
          where: { id: value.parentPositionId },
          select: { id: true, archivedAt: true },
        });
        if (!proposed) throw Object.assign(new Error('unknown parent position'), { status: 404 });
        if (proposed.archivedAt) {
          throw Object.assign(new Error('Le poste supérieur visé est archivé.'), { status: 409 });
        }

        const seen = new Set([req.params.id]);
        let cursor = value.parentPositionId;
        while (cursor) {
          if (cursor === req.params.id) {
            throw Object.assign(
              new Error(
                'Impossible : ce poste serait rattaché à l’un de ses propres subordonnés, ce qui détacherait la branche de l’organigramme.',
              ),
              { status: 409 },
            );
          }
          if (seen.has(cursor)) break;
          seen.add(cursor);

          const parent = await context.tx.position.findUnique({
            where: { id: cursor },
            select: { parentPositionId: true },
          });
          cursor = parent?.parentPositionId ?? null;
        }
      }

      const after = await context.tx.position.update({
        where: { id: req.params.id },
        data: { parentPositionId: value.parentPositionId },
      });

      await context.audit({
        action: 'entity.updated',
        entityType: 'position',
        entityId: after.id,
        before: { parentPositionId: before.parentPositionId },
        after: { parentPositionId: after.parentPositionId },
      });

      return { id: after.id, parentPositionId: after.parentPositionId };
    },
  });

  sendActionResult(res, result);
});

const ArchivePosition = z.object({});

router.delete('/:id', async (req, res, next) => {
  const result = await mutate(req, {}, {
    schema: ArchivePosition,
    requires: { resource: 'position', action: 'delete' },
    target: async () => {
      const position = await prisma.position.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { organizationUnitId: true },
      });
      return { organizationUnitId: position.organizationUnitId };
    },
    run: async (value, context) => {
      const before = await context.tx.position.findUnique({ where: { id: req.params.id } });
      if (!before) throw Object.assign(new Error('unknown position'), { status: 404 });

      const held = await context.tx.assignment.count({
        where: { positionId: req.params.id, endDate: null },
      });
      if (held > 0) {
        throw Object.assign(new Error('Ce poste est actuellement occupé.'), { status: 409 });
      }

      const after = await context.tx.position.update({
        where: { id: req.params.id },
        data: { archivedAt: new Date() },
      });

      await context.audit({
        action: 'entity.deleted',
        entityType: 'position',
        entityId: after.id,
        before,
        after,
      });

      return { id: after.id };
    },
  });
  sendActionResult(res, result);
});

export default router;
