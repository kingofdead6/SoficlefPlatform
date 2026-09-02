import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';

/**
 * The contacts directory — ported from app/[locale]/(app)/contacts/page.tsx. Gated on
 * `dashboard:read` (see Client/src/lib/navigation.js's `contacts` nav item); writes use
 * `dashboard:read` too since no dedicated resource exists — ADMIN is the only role likely
 * to touch this catalogue in practice via `setting:update`.
 */

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'dashboard');

    const contacts = await prisma.contact.findMany({
      orderBy: [{ priorityRank: 'asc' }, { order: 'asc' }],
    });

    res.json({ data: contacts });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const ContactInput = z.object({
  extension: z.string().trim().min(1),
  initials: z.string().trim().min(1),
  nameFr: z.string().trim().min(1),
  roleFr: z.string().trim().min(1),
  priorityFr: z.string().trim().min(1),
  priorityRank: z.enum(['S1', 'S2']),
  order: z.number().int().default(0),
});

router.post('/', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: ContactInput,
      requires: { resource: 'setting', action: 'update' },
      run: async (value, context) => {
        const created = await context.tx.contact.create({ data: value });
        await context.audit({
          action: 'entity.created',
          entityType: 'contact',
          entityId: created.id,
          after: created,
        });
        return created;
      },
    });
    sendActionResult(res, result, 201);
  } catch (error) {
    next(error);
  }
});

const UpdateContact = ContactInput.partial().extend({ id: z.string().uuid() });

router.patch('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: UpdateContact,
      requires: { resource: 'setting', action: 'update' },
      run: async (value, context) => {
        const { id, ...data } = value;
        const before = await context.tx.contact.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error('unknown contact'), { status: 404 });
        const after = await context.tx.contact.update({ where: { id }, data });
        await context.audit({
          action: 'entity.updated',
          entityType: 'contact',
          entityId: id,
          before,
          after,
        });
        return after;
      },
    });
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

const DeleteContact = z.object({ id: z.string().uuid() });

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id }, {
      schema: DeleteContact,
      requires: { resource: 'setting', action: 'update' },
      run: async (value, context) => {
        const existing = await context.tx.contact.findUnique({ where: { id: value.id } });
        if (!existing) throw Object.assign(new Error('unknown contact'), { status: 404 });
        await context.tx.contact.delete({ where: { id: value.id } });
        await context.audit({
          action: 'entity.deleted',
          entityType: 'contact',
          entityId: value.id,
          before: existing,
        });
        return { id: value.id };
      },
    });
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
