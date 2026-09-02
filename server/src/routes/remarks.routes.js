import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { scopeFilterFor } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * The remarks journal (CDC v1 §3.7) — ported from app/actions/remarks.ts (add/delete) and
 * app/api/v1/remarks/export/route.ts (export). A remark is the collaborator's own
 * observation to HR/DG: EMPLOYEE holds `remark:create`/`remark:delete` SELF-scoped,
 * HR/ADMIN hold `remark:read` to read and export everyone's.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const scope = scopeFilterFor(req.user, 'read', 'remark');
    if (scope.kind === 'none') return res.status(403).json({ error: 'forbidden' });

    const where =
      scope.kind === 'self'
        ? { authorId: req.user.id }
        : scope.kind === 'units'
          ? {
              author: {
                userRoles: { some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } } },
              },
            }
          : {};

    const remarks = await prisma.remark.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, displayName: true } } },
    });

    res.json({ data: remarks });
  } catch (error) {
    next(error);
  }
});

const AddRemark = z.object({
  contentFr: z.string().trim().min(1, 'La remarque ne peut pas être vide.').max(5000),
});

router.post('/', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: AddRemark,
      requires: { resource: 'remark', action: 'create' },
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
        return created;
      },
    });
    sendActionResult(res, result, 201);
  } catch (error) {
    next(error);
  }
});

const DeleteRemark = z.object({ id: z.string().uuid() });

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id }, {
      schema: DeleteRemark,
      requires: { resource: 'remark', action: 'delete' },
      target: async (value) => {
        const remark = await prisma.remark.findUnique({ where: { id: value.id }, select: { authorId: true } });
        if (!remark) throw Object.assign(new Error('unknown remark'), { status: 404 });
        return { ownerUserId: remark.authorId };
      },
      run: async (value, context) => {
        const existing = await context.tx.remark.findUnique({ where: { id: value.id } });
        if (!existing) throw Object.assign(new Error('unknown remark'), { status: 404 });
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
    });
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/remarks/export — ported from app/api/v1/remarks/export/route.ts. The
 * remarks journal as a text file, scope-respecting, audited (report.exported).
 */
router.get('/export', async (req, res, next) => {
  try {
    const user = req.user;
    const scope = scopeFilterFor(user, 'read', 'remark');
    if (scope.kind === 'none') return res.status(403).json({ error: 'forbidden' });

    const where =
      scope.kind === 'self'
        ? { authorId: user.id }
        : scope.kind === 'units'
          ? {
              author: {
                userRoles: { some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } } },
              },
            }
          : {};

    const remarks = await prisma.remark.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { displayName: true } } },
    });

    const stamp = (value) =>
      new Intl.DateTimeFormat('fr-DZ', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Africa/Algiers',
        numberingSystem: 'latn',
      }).format(value);

    const lines = [
      'SOFICLEF — Remarques & Recommandations',
      `Exporté le ${stamp(new Date())} par ${user.displayName}`,
      '='.repeat(60),
      '',
      ...(remarks.length === 0
        ? ['Aucune remarque enregistrée.']
        : remarks.flatMap((remark, index) => [
            `${index + 1}. [${stamp(remark.createdAt)}] ${remark.author.displayName}`,
            remark.contentFr,
            '',
          ])),
    ];

    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? String(forwarded).split(',')[0].trim() : (req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? null);

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorLabel: user.displayName,
        action: 'report.exported',
        entityType: 'remark',
        entityId: null,
        before: undefined,
        after: { format: 'txt', count: remarks.length },
        ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });

    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="remarques-soficlef.txt"',
      'Cache-Control': 'no-store',
    });
    res.send(lines.join('\n'));
  } catch (error) {
    next(error);
  }
});

export default router;
