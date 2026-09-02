import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../infrastructure/middleware/auth.js';
import { assertCanAnyScope } from '../domain/auth/authorization.js';
import { mutate, sendActionResult } from '../application/shared/mutate.js';
import { prisma } from '../infrastructure/db/client.js';

const router = Router();
router.use(requireAuth);

/**
 * Onboarding path templates and their milestone sequence (route guide §2.3,
 * /app/hr/templates and /app/hr/templates/[id]).
 *
 * A template is the *library* entry — the sequence of steps a profile goes through — while
 * OnboardingInstance is one person's run of it. Nothing here touches instances: editing a
 * template must never silently rewrite the path of somebody already halfway through it.
 *
 * Permissions follow the catalogue as it stands: HR holds `onboarding_template:read` only,
 * so HR reads the library and the builder is read-only for HR; ADMIN holds create/update.
 * The endpoints are gated on the real permission rather than on the permission that would
 * be convenient, and the client hides/disables the write controls accordingly.
 */

const DEPARTMENTS = ['HR', 'IT', 'HSE', 'QUALITY', 'MANAGER', 'EMPLOYEE'];
const PHASES = ['PRE_ONBOARDING', 'DAY_ONE', 'PROBATION'];

/** Slug for a milestone created in the builder — stable, unique, and readable in the DB. */
function milestoneSlug(templateSlug, order, titleFr) {
  // NFD splits accented letters into base + combining mark, and the [^a-z0-9] pass then
  // drops the marks — so "Préparer" slugs to "preparer" rather than to "pr-parer".
  const base = titleFr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${templateSlug}-${String(order).padStart(2, '0')}-${base || 'etape'}`;
}

router.get('/', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'onboarding_template');

    const rows = await prisma.onboardingTemplate.findMany({
      orderBy: { titleFr: 'asc' },
      select: {
        id: true,
        slug: true,
        titleFr: true,
        createdAt: true,
        updatedAt: true,
        position: { select: { id: true, code: true, titleFr: true } },
        _count: { select: { milestones: true, instances: true } },
      },
    });

    res.json({
      data: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        titleFr: row.titleFr,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        position: row.position,
        milestoneCount: row._count.milestones,
        instanceCount: row._count.instances,
      })),
    });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    assertCanAnyScope(req.user, 'read', 'onboarding_template');

    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        slug: true,
        titleFr: true,
        createdAt: true,
        updatedAt: true,
        position: { select: { id: true, code: true, titleFr: true } },
        _count: { select: { instances: true } },
        milestones: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            slug: true,
            order: true,
            dayLabelFr: true,
            dayOffset: true,
            titleFr: true,
            detailFr: true,
            isRecommended: true,
            phase: true,
            ownerDepartment: true,
          },
        },
      },
    });
    if (!template) return res.status(404).json({ error: 'not-found' });

    res.json({ data: { ...template, instanceCount: template._count.instances } });
  } catch (error) {
    if (error?.status === 403) return res.status(403).json({ error: 'forbidden' });
    next(error);
  }
});

const CreateTemplate = z.object({
  slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9-]+$/),
  titleFr: z.string().trim().min(2).max(160),
  positionId: z.string().uuid().nullable().optional(),
});

router.post('/', async (req, res) => {
  const result = await mutate(req, req.body, {
    schema: CreateTemplate,
    requires: { resource: 'onboarding_template', action: 'create' },
    run: async (value, context) => {
      const clash = await context.tx.onboardingTemplate.findUnique({
        where: { slug: value.slug },
        select: { id: true },
      });
      if (clash) throw Object.assign(new Error('Ce code de modèle est déjà utilisé.'), { status: 409 });

      const created = await context.tx.onboardingTemplate.create({
        data: {
          slug: value.slug,
          titleFr: value.titleFr,
          positionId: value.positionId ?? null,
        },
        select: { id: true, slug: true, titleFr: true },
      });

      await context.audit({
        action: 'entity.created',
        entityType: 'onboarding_template',
        entityId: created.id,
        after: created,
      });

      return created;
    },
  });

  sendActionResult(res, result, 201);
});

const MilestoneInput = z.object({
  id: z.string().uuid().optional(),
  titleFr: z.string().trim().min(2).max(200),
  detailFr: z.string().trim().max(4000).default(''),
  dayOffset: z.coerce.number().int().min(-90).max(365),
  dayLabelFr: z.string().trim().min(1).max(40),
  ownerDepartment: z.enum(DEPARTMENTS).nullable().optional(),
  phase: z.enum(PHASES).nullable().optional(),
  isRecommended: z.coerce.boolean().default(false),
  order: z.coerce.number().int().min(0),
});

const ReplaceMilestones = z.object({
  templateId: z.string().uuid(),
  milestones: z.array(MilestoneInput).max(120),
});

/**
 * PATCH /:id/milestones — replaces the whole sequence in one transaction.
 *
 * Sending the full list rather than per-row edits is what makes reordering expressible at
 * all: `order` is only meaningful relative to its siblings, so a partial update would let
 * two steps claim the same rank. Milestones the client dropped are deleted, which cascades
 * to their `OnboardingTaskCompletion` rows — hence the guard below refusing to delete a
 * milestone that people have already progressed through.
 *
 * One audit row for the whole operation: this is one editorial act, not N.
 */
router.patch('/:id/milestones', async (req, res) => {
  const result = await mutate(req, { templateId: req.params.id, milestones: req.body?.milestones ?? [] }, {
    schema: ReplaceMilestones,
    requires: { resource: 'onboarding_template', action: 'update' },
    run: async (value, context) => {
      const template = await context.tx.onboardingTemplate.findUnique({
        where: { id: value.templateId },
        select: { id: true, slug: true, milestones: { select: { id: true, order: true, titleFr: true } } },
      });
      if (!template) throw Object.assign(new Error('unknown template'), { status: 404 });

      const keptIds = new Set(value.milestones.map((m) => m.id).filter(Boolean));
      const removed = template.milestones.filter((m) => !keptIds.has(m.id));

      if (removed.length > 0) {
        const progressed = await context.tx.onboardingTaskCompletion.count({
          where: { milestoneId: { in: removed.map((m) => m.id) } },
        });
        if (progressed > 0) {
          throw Object.assign(
            new Error(
              'Certaines étapes supprimées sont déjà suivies dans un parcours en cours. Retirez-les du parcours avant de les supprimer du modèle.',
            ),
            { status: 409 },
          );
        }
        await context.tx.onboardingMilestone.deleteMany({ where: { id: { in: removed.map((m) => m.id) } } });
      }

      for (const [index, milestone] of value.milestones.entries()) {
        const data = {
          order: milestone.order ?? index,
          dayLabelFr: milestone.dayLabelFr,
          dayOffset: milestone.dayOffset,
          titleFr: milestone.titleFr,
          detailFr: milestone.detailFr ?? '',
          isRecommended: milestone.isRecommended ?? false,
          phase: milestone.phase ?? null,
          ownerDepartment: milestone.ownerDepartment ?? null,
        };

        if (milestone.id && !removed.some((m) => m.id === milestone.id)) {
          await context.tx.onboardingMilestone.update({ where: { id: milestone.id }, data });
        } else {
          await context.tx.onboardingMilestone.create({
            data: {
              ...data,
              templateId: template.id,
              slug: milestoneSlug(template.slug, milestone.order ?? index, milestone.titleFr),
            },
          });
        }
      }

      await context.audit({
        action: 'entity.updated',
        entityType: 'onboarding_template',
        entityId: template.id,
        before: { milestones: template.milestones.length },
        after: { milestones: value.milestones.length, removed: removed.length },
      });

      return { templateId: template.id, milestones: value.milestones.length };
    },
  });

  sendActionResult(res, result);
});

export default router;
