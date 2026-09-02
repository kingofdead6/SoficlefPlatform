import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { upload } from '../infrastructure/middleware/upload.js';
import { uploadBuffer, urlFor, remove } from '../infrastructure/storage/cloudinary.js';

/**
 * The administrative papers a recruit owes HR (`/app/me/files`) — ported from
 * app/[locale]/(app)/app/me/files/page.tsx and the `submitPersonalFile` action in
 * app/actions/me.ts. The source app never actually stored bytes (storage was
 * intentionally unwired, OQ-14/OQ-15); here Cloudinary is real, so submission uploads the
 * file rather than just declaring "I sent it by another channel."
 *
 * Second upload-bearing domain named in the migration brief. HR review/accept flow is not
 * present as a source action file, so it's built here following the same mutate() shape:
 * `document:update` (held by HR/ADMIN) accepts or rejects a submitted file.
 */

const router = Router();
router.use(requireAuth);

async function withUrl(file) {
  if (!file) return file;
  const url = file.storageKey ? await urlFor(file.storageKey) : null;
  return { ...file, url };
}

/** GET /api/v1/personal-files/me — the caller's own obligations, anchored on the caller. */
router.get('/me', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'document');

    const files = await prisma.personalFile.findMany({
      where: { userId: req.user.id },
      orderBy: [{ status: 'asc' }, { labelFr: 'asc' }],
    });

    res.json({ data: await Promise.all(files.map(withUrl)) });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/** GET /api/v1/personal-files — HR/ADMIN review queue, every collaborator's files. */
router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'update', 'document');

    const files = await prisma.personalFile.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });

    res.json({ data: await Promise.all(files.map(withUrl)) });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const RequestFile = z.object({
  userId: z.string().uuid(),
  kind: z.enum(['ID_CARD', 'DIPLOMA', 'BANK_DETAILS', 'MEDICAL_CERTIFICATE', 'OTHER']),
  labelFr: z.string().trim().min(1),
});

/** POST /api/v1/personal-files — HR requests a specific piece from a collaborator. */
router.post('/', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: RequestFile,
      requires: { resource: 'document', action: 'update' },
      run: async (value, context) => {
        const created = await context.tx.personalFile.create({
          data: { userId: value.userId, kind: value.kind, labelFr: value.labelFr, status: 'REQUESTED' },
        });
        await context.audit({
          action: 'entity.created',
          entityType: 'personal_file',
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

/**
 * POST /api/v1/personal-files/:id/submit — the collaborator uploads the file. Scoped to
 * the caller: a file id belonging to somebody else is not found, never found-then-refused
 * (ADR-021, mirrored from the source action).
 */
router.post('/:id/submit', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(422).json({ error: 'invalid', message: 'Aucun fichier reçu.' });

    const result = await mutate(
      req,
      { id: req.params.id, noteFr: req.body?.noteFr ?? '' },
      {
        schema: z.object({ id: z.string().uuid(), noteFr: z.string().trim().max(500).optional() }),
        requires: { resource: 'document', action: 'read' },
        target: (_value, user) => ({ ownerUserId: user.id }),
        run: async (value, context) => {
          const file = await context.tx.personalFile.findFirst({
            where: { id: value.id, userId: context.user.id },
          });
          if (!file) throw Object.assign(new Error('unknown file'), { status: 404 });
          if (file.status === 'ACCEPTED') {
            throw Object.assign(new Error('Cette pièce est déjà validée.'), { status: 409 });
          }

          const stored = await uploadBuffer({
            buffer: req.file.buffer,
            fileName: req.file.originalname,
            contentType: req.file.mimetype,
            folder: 'soficlef/personal-files',
          }).catch((error) => {
            throw Object.assign(error, { status: error.status ?? 500 });
          });

          if (file.storageKey) await remove(file.storageKey).catch(() => {});

          const after = await context.tx.personalFile.update({
            where: { id: file.id },
            data: {
              status: 'SUBMITTED',
              submittedAt: new Date(),
              fileName: stored.fileName,
              storageKey: stored.key,
              noteFr: value.noteFr || file.noteFr,
            },
          });

          await context.audit({
            action: 'personal_file.submitted',
            entityType: 'personal_file',
            entityId: file.id,
            before: { status: file.status },
            after: { status: after.status, fileName: after.fileName },
          });

          return { ...after, url: stored.url };
        },
      },
    );
    sendActionResult(res, result, 201);
  } catch (error) {
    next(error);
  }
});

const ReviewFile = z.object({
  id: z.string().uuid(),
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  noteFr: z.string().trim().max(500).optional(),
});

/** PATCH /api/v1/personal-files/:id/review — HR accepts or rejects a submitted file. */
router.patch('/:id/review', async (req, res, next) => {
  try {
    const result = await mutate(
      req,
      { id: req.params.id, decision: req.body?.decision, noteFr: req.body?.noteFr },
      {
        schema: ReviewFile,
        requires: { resource: 'document', action: 'update' },
        run: async (value, context) => {
          const before = await context.tx.personalFile.findUnique({ where: { id: value.id } });
          if (!before) throw Object.assign(new Error('unknown file'), { status: 404 });

          const after = await context.tx.personalFile.update({
            where: { id: value.id },
            data: {
              status: value.decision,
              reviewedAt: new Date(),
              reviewedBy: context.user.id,
              noteFr: value.noteFr ?? before.noteFr,
            },
          });

          await context.audit({
            action: 'personal_file.reviewed',
            entityType: 'personal_file',
            entityId: value.id,
            before: { status: before.status },
            after: { status: after.status },
          });

          return after;
        },
      },
    );
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
