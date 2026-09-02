import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/notifications — the signed-in user's notification centre (CDC v0.1 §9).
 * Ported from application/notifications/inbox.ts.
 *
 * Scoped by construction: a notification belongs to exactly one recipient, so the query
 * filters on the session's own id and there is no cross-user read to guard against.
 * Capped at 20 — the bell is a recent-activity view, not an archive.
 */
router.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });

    const data = rows.map((row) => ({
      id: row.id,
      titleFr: row.titleFr,
      bodyFr: row.bodyFr,
      href: row.href,
      createdAt: row.createdAt,
      read: row.readAt !== null,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

const MarkRead = z.object({ id: z.string().uuid().optional() });

/**
 * POST /api/v1/notifications/mark-read — ported from app/actions/notifications.ts.
 *
 * Marking a notification read is scoped to its recipient by the query itself — the
 * `userId` in the `where` clause is the session's, never the payload's, so one reader
 * cannot clear another's centre even by guessing an id. Body `{ id }` marks one
 * notification; an omitted `id` marks every unread one for this user.
 */
router.post('/mark-read', async (req, res) => {
  const result = await mutate(req, req.body ?? {}, {
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
  });

  sendActionResult(res, result);
});

export default router;
