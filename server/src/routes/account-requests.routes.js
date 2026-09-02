import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/v1/account-requests — requests HR has raised with SI (CDC-2026 Module 1).
 *
 * Ported from application/organization/assignments.ts `listAccountRequests`. That
 * function also lives in the source app's assignments module (surfaced there next to
 * `listPendingAccounts`); this route implements its own read rather than importing an
 * assignments-routes helper, since server/src/routes/assignments.routes.js was still a
 * stub at the time this file was written. If assignments.routes.js later grows a
 * `listAccountRequests`-backed endpoint, the two should be reconciled to avoid drift —
 * this one is authoritative for `/api/v1/account-requests`.
 *
 * Newest state first (OPEN before CREATED/REJECTED), oldest request first within it.
 * `waitingDays` is computed here rather than left to the client: a duration is a property
 * of the data at the moment it is read.
 */
router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'assignment');

    const limit = Math.min(Number(req.query.limit) || 25, 200);

    const rows = await prisma.accountRequest.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      take: limit,
      select: {
        id: true,
        candidateNameFr: true,
        plannedPositionFr: true,
        plannedHireDate: true,
        urgency: true,
        status: true,
        noteFr: true,
        createdAt: true,
        requestedBy: { select: { id: true, displayName: true, email: true } },
      },
    });

    const now = Date.now();
    const data = rows.map((row) => ({
      ...row,
      waitingDays: Math.floor((now - row.createdAt.getTime()) / 86_400_000),
    }));

    res.json({ data });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const RequestAccount = z.object({
  candidateNameFr: z.string().trim().min(2).max(120),
  plannedPositionFr: z.string().trim().min(2).max(120),
  plannedHireDate: z.coerce.date().nullable().optional(),
  urgency: z.enum(['NORMAL', 'URGENT']),
  noteFr: z.string().trim().max(1000).optional(),
});

/**
 * POST /api/v1/account-requests — HR asking SI to create an account, the first hop of
 * the provisioning chain. Ported from app/actions/account-requests.ts.
 *
 * HR deliberately holds no `user:create`, so this records a request rather than creating
 * anything. Gated on `assignment:create` — the permission that defines HR — rather than
 * on `user:create`, which HR must never hold.
 */
router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: RequestAccount,
    requires: { resource: 'assignment', action: 'create' },
    run: async (value, context) => {
      const created = await context.tx.accountRequest.create({
        data: {
          candidateNameFr: value.candidateNameFr,
          plannedPositionFr: value.plannedPositionFr,
          plannedHireDate: value.plannedHireDate ?? null,
          urgency: value.urgency,
          noteFr: value.noteFr ?? null,
          requestedById: context.user.id,
        },
        select: { id: true },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'account_request',
        entityId: created.id,
        before: null,
        after: {
          candidateNameFr: value.candidateNameFr,
          plannedPositionFr: value.plannedPositionFr,
          urgency: value.urgency,
        },
      });

      return { requestId: created.id };
    },
  });

  sendActionResult(res, result, 201);
});

export default router;
