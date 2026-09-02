import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { prisma } from '../infrastructure/db/client.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { audienceFilter } from '../application/documents/audience.js';
import { upload } from '../infrastructure/middleware/upload.js';
import { uploadBuffer, urlFor, remove, isStorageConfigured } from '../infrastructure/storage/cloudinary.js';

/**
 * The document library — ported from app/[locale]/(app)/documents/page.tsx (read),
 * app/[locale]/(app)/app/hr/documents/page.tsx (HR admin view with acknowledgement rate)
 * and app/[locale]/(app)/app/me/documents/page.tsx (employee's own acknowledgement flow).
 *
 * `document:read` covers listing and reading; `document:create`/`document:update` (HR,
 * ADMIN) cover publishing/editing including the file upload wired to Cloudinary — this is
 * one of the two upload-bearing domains named in the migration brief.
 */

const router = Router();
router.use(requireAuth);

async function withUrl(doc) {
  if (!doc) return doc;
  const url = doc.storageKey ? await urlFor(doc.storageKey) : null;
  return { ...doc, url };
}

/**
 * The visibility predicate for one caller, applied in the Prisma query (ADR-021).
 *
 * The rule itself now lives in application/documents/audience.js, because the assistant's
 * documentary agent has to apply exactly the same one. Keeping a local alias here preserves
 * the reading of the handlers below while guaranteeing there is only one definition to fix.
 */
const visibilityWhere = audienceFilter;

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'document');

    const scoped = visibilityWhere(req.user);

    const documents = await prisma.document.findMany({
      ...(scoped ? { where: scoped } : {}),
      orderBy: [{ availability: 'asc' }, { order: 'asc' }],
      include: { _count: { select: { acknowledgements: true } } },
    });

    const withUrls = await Promise.all(documents.map(withUrl));
    res.json({ data: withUrls, storageConfigured: isStorageConfigured() });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/** GET /api/v1/documents/me — the caller's own acknowledgement status per document. */
router.get('/me', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'document');

    const scoped = visibilityWhere(req.user);

    const [documents, myAcks] = await Promise.all([
      prisma.document.findMany({
        ...(scoped ? { where: scoped } : {}),
        orderBy: [{ availability: 'asc' }, { order: 'asc' }],
      }),
      prisma.documentAcknowledgement.findMany({ where: { userId: req.user.id } }),
    ]);

    const ackByDoc = new Map(myAcks.map((ack) => [ack.documentId, ack]));
    const withUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...(await withUrl(doc)),
        acknowledgedAt: ackByDoc.get(doc.id)?.acceptedAt ?? null,
      })),
    );

    res.json({ data: withUrls });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/**
 * GET /api/v1/documents/departments — the real department names an account can be targeted
 * by, so the publish UI offers actual values instead of free text that would never match.
 *
 * Declared before `/:id` so the literal path is not swallowed by the id parameter.
 * Gated on document:create: this is a publishing aid, not library content.
 */
router.get('/departments', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'create', 'document');

    const [directions, services] = await Promise.all([
      prisma.user.findMany({
        where: { directionFr: { not: null } },
        distinct: ['directionFr'],
        select: { directionFr: true },
      }),
      prisma.user.findMany({
        where: { serviceFr: { not: null } },
        distinct: ['serviceFr'],
        select: { serviceFr: true },
      }),
    ]);

    const names = [
      ...new Set([
        ...directions.map((row) => row.directionFr),
        ...services.map((row) => row.serviceFr),
      ]),
    ]
      .filter((name) => name && name.trim())
      .sort((a, b) => a.localeCompare(b, 'fr'));

    res.json({ data: names });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'document');

    // The same visibility predicate as the list: fetching a department-restricted document
    // by its id must not be a way around the filter. Out-of-scope is 404, not 403 — whether
    // a document exists is itself part of what the restriction hides.
    const scoped = visibilityWhere(req.user);
    const doc = await prisma.document.findFirst({
      where: { id: req.params.id, ...(scoped ?? {}) },
    });
    if (!doc) return res.status(404).json({ error: 'not-found' });
    res.json({ data: await withUrl(doc) });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

/**
 * Visibility as a pair of fields, shared by create/update/publish.
 *
 * "DEPARTMENTS" with an empty list would be a document nobody but its publisher can see —
 * almost certainly a mistake rather than an intent, so it is refused at the boundary.
 */
const VisibilityFields = {
  visibility: z.enum(['ALL', 'DEPARTMENTS']),
  departmentsFr: z.array(z.string().trim().min(1)).max(50).default([]),
};

function assertDepartmentsPresent(value, ctx) {
  if (value.visibility === 'DEPARTMENTS' && (value.departmentsFr?.length ?? 0) === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['departmentsFr'],
      message: 'Sélectionnez au moins un département à cibler.',
    });
  }
}

const CreateDocument = z
  .object({
    slug: z.string().trim().min(1),
    titleFr: z.string().trim().min(1),
    detailFr: z.string().trim().optional(),
    availability: z.enum(['AVAILABLE', 'PENDING']).default('PENDING'),
    order: z.number().int().default(0),
    visibility: VisibilityFields.visibility.default('ALL'),
    departmentsFr: VisibilityFields.departmentsFr,
  })
  .superRefine(assertDepartmentsPresent);

router.post('/', async (req, res, next) => {
  try {
    const result = await mutate(req, req.body, {
      schema: CreateDocument,
      requires: { resource: 'document', action: 'create' },
      run: async (value, context) => {
        const created = await context.tx.document.create({ data: value });
        await context.audit({
          action: 'entity.created',
          entityType: 'document',
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

const UpdateDocument = z
  .object({
    id: z.string().uuid(),
    titleFr: z.string().trim().min(1).optional(),
    detailFr: z.string().trim().optional(),
    availability: z.enum(['AVAILABLE', 'PENDING']).optional(),
    order: z.number().int().optional(),
    visibility: VisibilityFields.visibility.optional(),
    departmentsFr: z.array(z.string().trim().min(1)).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    // Only checked when visibility is actually being set to DEPARTMENTS in this PATCH: a
    // partial update that touches neither field must not be rejected for a list it is not
    // sending. Switching to DEPARTMENTS does require naming them in the same request.
    if (value.visibility === 'DEPARTMENTS' && (value.departmentsFr?.length ?? 0) === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['departmentsFr'],
        message: 'Sélectionnez au moins un département à cibler.',
      });
    }
  });

router.patch('/:id', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: UpdateDocument,
      requires: { resource: 'document', action: 'update' },
      run: async (value, context) => {
        const { id, ...data } = value;
        const before = await context.tx.document.findUnique({ where: { id } });
        if (!before) throw Object.assign(new Error('unknown document'), { status: 404 });
        const after = await context.tx.document.update({ where: { id }, data });
        await context.audit({
          action: 'entity.updated',
          entityType: 'document',
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

/**
 * POST /api/v1/documents/:id/upload — attaches (or replaces) the file for a document.
 * multer buffers the upload in memory; uploadBuffer streams it to Cloudinary. Without
 * Cloudinary credentials this throws StorageNotConfiguredError, which mutate() surfaces
 * as a clean 501 rather than crashing.
 */
router.post('/:id/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(422).json({ error: 'invalid', message: 'Aucun fichier reçu.' });

    const result = await mutate(
      req,
      { id: req.params.id },
      {
        schema: z.object({ id: z.string().uuid() }),
        requires: { resource: 'document', action: 'update' },
        run: async (value, context) => {
          const before = await context.tx.document.findUnique({ where: { id: value.id } });
          if (!before) throw Object.assign(new Error('unknown document'), { status: 404 });

          let stored;
          try {
            stored = await uploadBuffer({
              buffer: req.file.buffer,
              fileName: req.file.originalname,
              contentType: req.file.mimetype,
              folder: 'soficlef/documents',
            });
          } catch (error) {
            throw Object.assign(error, { status: error.status ?? 500 });
          }

          if (before.storageKey) await remove(before.storageKey).catch(() => {});

          const after = await context.tx.document.update({
            where: { id: value.id },
            data: {
              fileName: stored.fileName,
              storageKey: stored.key,
              availability: 'AVAILABLE',
            },
          });

          await context.audit({
            action: 'document.uploaded',
            entityType: 'document',
            entityId: after.id,
            before: { fileName: before.fileName },
            after: { fileName: after.fileName, storageKey: after.storageKey },
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

const PublishDocument = z
  .object({
    id: z.string().uuid(),
    visibility: VisibilityFields.visibility.default('ALL'),
    departmentsFr: VisibilityFields.departmentsFr,
  })
  .superRefine(assertDepartmentsPresent);

/**
 * POST /api/v1/documents/:id/publish — the "accept → publish" action.
 *
 * Flips the document to AVAILABLE and applies its audience in one audited mutation, so the
 * document and the answer to "who can now see this" become true at the same instant rather
 * than in two steps with a window in between where it is public to everyone.
 *
 * Gated on `document:create`, NOT `document:update`: HR holds create but not update (see
 * ROLE_PERMISSIONS in domain/auth/permissions.js), and publishing is precisely the HR action
 * this endpoint exists for. Gating it on update would hand it to ADMIN alone and lock out the
 * role that does the work. ADMIN holds create as well, so nothing is lost at the top end.
 */
router.post('/:id/publish', async (req, res, next) => {
  try {
    const result = await mutate(req, { id: req.params.id, ...req.body }, {
      schema: PublishDocument,
      requires: { resource: 'document', action: 'create' },
      run: async (value, context) => {
        const before = await context.tx.document.findUnique({ where: { id: value.id } });
        if (!before) throw Object.assign(new Error('unknown document'), { status: 404 });

        const after = await context.tx.document.update({
          where: { id: value.id },
          data: {
            availability: 'AVAILABLE',
            visibility: value.visibility,
            departmentsFr: value.visibility === 'DEPARTMENTS' ? value.departmentsFr : [],
          },
        });

        await context.audit({
          action: 'document.published',
          entityType: 'document',
          entityId: after.id,
          before: {
            availability: before.availability,
            visibility: before.visibility,
            departmentsFr: before.departmentsFr,
          },
          after: {
            availability: after.availability,
            visibility: after.visibility,
            departmentsFr: after.departmentsFr,
          },
        });

        return after;
      },
    });
    sendActionResult(res, result);
  } catch (error) {
    next(error);
  }
});

const AcknowledgeDocument = z.object({ documentId: z.string().uuid() });

/** POST /api/v1/documents/:id/acknowledge — the employee marks a document read/accepted. */
router.post('/:id/acknowledge', async (req, res, next) => {
  try {
    const result = await mutate(
      req,
      { documentId: req.params.id },
      {
        schema: AcknowledgeDocument,
        requires: { resource: 'document', action: 'read' },
        target: (_value, user) => ({ ownerUserId: user.id }),
        run: async (value, context) => {
          // Same visibility predicate as the reads: acknowledging is a read-then-accept, and
          // a document the caller may not see is not one they can be recorded as accepting.
          const scoped = visibilityWhere(context.user);
          const doc = await context.tx.document.findFirst({
            where: { id: value.documentId, ...(scoped ?? {}) },
          });
          if (!doc) throw Object.assign(new Error('unknown document'), { status: 404 });

          const ack = await context.tx.documentAcknowledgement.upsert({
            where: {
              documentId_userId: { documentId: value.documentId, userId: context.user.id },
            },
            create: { documentId: value.documentId, userId: context.user.id },
            update: {},
          });

          await context.audit({
            action: 'document.acknowledged',
            entityType: 'document_acknowledgement',
            entityId: ack.id,
            after: { documentId: value.documentId, userId: context.user.id },
          });

          return ack;
        },
      },
    );
    sendActionResult(res, result, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
