import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { ACTION_PERMISSION, transition } from '../domain/workflow/job-description.js';
import { loadDossier, listJobDescriptions, snapshotFrom } from '../application/job-description/versions.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * Job-description versioned workflow: dossier reads plus submit/approve/request_changes/
 * archive/reopen transitions and draft-forking.
 * Ported from SoficlefPlatform src/application/job-description/versions.ts and
 * src/app/actions/job-description.ts.
 */

// ---- reads ------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    res.json({ data: await listJobDescriptions(req.user) });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const dossier = await loadDossier(req.user, req.params.id);
    if (!dossier) return res.status(404).json({ error: 'not-found' });
    res.json({ data: dossier });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

// ---- mutations: workflow transitions -----------------------------------------

const ACTIONS = ['submit', 'approve', 'request_changes', 'archive', 'reopen'];

const ApplyAction = z.object({
  versionId: z.string().uuid(),
  action: z.enum(ACTIONS),
  commentFr: z.string().trim().max(2000).optional().or(z.literal('')),
});

router.post('/versions/action', async (req, res) => {
  const requested = String(req.body?.action ?? '');
  const kind = ACTIONS.includes(requested) ? requested : 'submit';

  const result = await mutate(req, req.body, {
    schema: ApplyAction,
    requires: { resource: 'job_description', action: ACTION_PERMISSION[kind] },
    /*
     * Job descriptions carry no per-unit scoping of their own — HR/ADMIN act on the whole
     * catalogue regardless of which unit their grant happens to be scoped to (mirroring
     * listJobDescriptions/loadDossier, which use assertCanAnyScope for the same reason).
     * mutate() always re-checks through assertCan()/scopeCovers(), which for an
     * ORGANIZATION_UNIT-scoped caller only ever passes when the target names a unit that
     * scope actually covers — so this hands back one of the caller's own covered units,
     * satisfying that check without adding a scoping rule this resource doesn't have.
     */
    target: (_value, user) => {
      const scopedAssignment = user.assignments.find((assignment) => assignment.scope.kind === 'ORGANIZATION_UNIT');
      const organizationUnitId =
        scopedAssignment?.scope.organizationUnitIds?.[0] ?? scopedAssignment?.scope.organizationUnitId ?? undefined;
      return { organizationUnitId };
    },
    run: async (value, context) => {
      const version = await context.tx.jobDescriptionVersion.findUnique({
        where: { id: value.versionId },
        select: { id: true, status: true, jobDescriptionId: true },
      });
      if (!version) throw Object.assign(new Error('unknown version'), { status: 404 });

      const moved = transition(version.status, value.action);
      const validated = moved.to === 'VALIDATED';

      const updated = await context.tx.jobDescriptionVersion.update({
        where: { id: version.id },
        data: {
          status: moved.to,
          validatedAt: validated ? new Date() : null,
          validatedBy: validated ? context.user.id : null,
        },
      });

      await context.tx.workflowAction.create({
        data: {
          entityType: 'job_description_version',
          entityId: version.id,
          action: moved.action,
          fromStatus: moved.from,
          toStatus: moved.to,
          commentFr: value.commentFr ? value.commentFr : null,
          actorId: context.user.id,
        },
      });

      await context.audit({
        action: validated ? 'entity.validated' : 'entity.updated',
        entityType: 'job_description_version',
        entityId: version.id,
        before: { status: moved.from },
        after: { status: moved.to },
      });

      return { status: updated.status };
    },
  });

  sendActionResult(res, result);
});

const CreateDraft = z.object({
  jobDescriptionId: z.string().uuid(),
  reasonFr: z.string().trim().min(3, 'Indiquez le motif de la nouvelle version.').max(500),
});

router.post('/versions/draft', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateDraft,
    requires: { resource: 'job_description', action: 'update' },
    run: async (value, context) => {
      const document = await context.tx.jobDescription.findUnique({
        where: { id: value.jobDescriptionId },
        include: {
          missions: { orderBy: { order: 'asc' } },
          permanentTasks: { orderBy: { order: 'asc' } },
          responsibilities: { orderBy: { order: 'asc' } },
          jobDescriptionVersions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        },
      });
      if (!document) throw Object.assign(new Error('unknown job description'), { status: 404 });

      const open = await context.tx.jobDescriptionVersion.count({
        where: {
          jobDescriptionId: value.jobDescriptionId,
          status: { in: ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED'] },
        },
      });
      if (open > 0) {
        throw Object.assign(new Error('Une version est déjà en cours de rédaction ou de revue.'), { status: 409 });
      }

      const versionNumber = (document.jobDescriptionVersions[0]?.versionNumber ?? 0) + 1;

      const created = await context.tx.jobDescriptionVersion.create({
        data: {
          jobDescriptionId: document.id,
          versionNumber,
          status: 'DRAFT',
          content: snapshotFrom(document),
          reasonFr: value.reasonFr,
          authorId: context.user.id,
        },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'job_description_version',
        entityId: created.id,
        after: { versionNumber, status: 'DRAFT' },
      });

      return { versionNumber, versionId: created.id };
    },
  });

  sendActionResult(res, result, 201);
});

// ---- mutations: job description CRUD (ADMIN/HR) -------------------------------

const CreateJobDescription = z.object({
  code: z.string().trim().min(1).max(40),
  positionId: z.string().uuid().nullable().optional(),
  jobTitleFr: z.string().trim().min(2).max(200),
  applicationDate: z.coerce.date(),
  applicationDateSourceFr: z.string().trim().max(200),
  positioningStructureFr: z.string().trim().max(2000),
  positioningProcessFr: z.string().trim().max(2000),
  positioningReportsToFr: z.string().trim().max(500),
  positioningSubordinatesFr: z.string().trim().max(500),
  requirementEducationFr: z.string().trim().max(500),
  requirementAdditionalEducationFr: z.string().trim().max(500),
  requirementExperienceFr: z.string().trim().max(500),
  requirementWorkPatternFr: z.string().trim().max(500),
});

router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateJobDescription,
    requires: { resource: 'job_description', action: 'create' },
    run: async (value, context) => {
      const created = await context.tx.jobDescription.create({ data: value });

      await context.audit({
        action: 'entity.created',
        entityType: 'job_description',
        entityId: created.id,
        after: { code: created.code, jobTitleFr: created.jobTitleFr },
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

export default router;
