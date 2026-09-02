import { Router } from 'express';

import { prisma } from '../infrastructure/db/client.js';

const router = Router();

/**
 * Unauthenticated read-only endpoints for the anonymous marketing pages, mirroring
 * SoficlefPlatform's `(public)` route group. Ported from
 * src/application/public/presentation.ts.
 *
 * These queries have no caller to check against `can()`, which is exactly why they are
 * isolated in their own route file with their own hand-picked `select`s rather than
 * reusing the authenticated company/strategy/recruitment repositories: each one names its
 * columns explicitly, so widening an authenticated read can never silently widen what an
 * anonymous visitor sees. Nothing below touches a table carrying personal data: no user,
 * no assessment, no remark, no onboarding row, no audit entry, no contact directory.
 */

router.get('/company', async (req, res, next) => {
  try {
    const company = await prisma.company.findFirst({
      select: {
        legalName: true,
        legalForm: true,
        foundedYear: true,
        foundedCity: true,
        headquarters: true,
        certification: true,
        status: true,
        website: true,
        visionFr: true,
        missionFr: true,
        activities: { orderBy: { order: 'asc' }, select: { labelFr: true, contentFr: true } },
      },
    });
    res.json({ data: company });
  } catch (error) {
    next(error);
  }
});

/** The four pillars of the Charte de Management — the one genuinely trilingual content. */
router.get('/values', async (req, res, next) => {
  try {
    const values = await prisma.companyValue.findMany({
      orderBy: { rank: 'asc' },
      select: { rank: true, nameFr: true, nameAr: true, nameEn: true },
    });
    res.json({ data: values });
  } catch (error) {
    next(error);
  }
});

router.get('/strategy', async (req, res, next) => {
  try {
    const strategy = await prisma.strategy.findFirst({
      select: {
        planFr: true,
        globalObjectiveFr: true,
        markets: {
          orderBy: { order: 'asc' },
          select: {
            marketFr: true,
            strategyFr: true,
            marketShareTargetFr: true,
            revenueTargetFr: true,
          },
        },
        projects: {
          orderBy: { order: 'asc' },
          select: { code: true, titleFr: true, descriptionFr: true },
        },
      },
    });
    res.json({ data: strategy });
  } catch (error) {
    next(error);
  }
});

/**
 * Open positions. `statusFr` is included because "En cours" is what tells a candidate the
 * post is still open; nothing identifies a person, and a vacancy is by nature public.
 */
router.get('/positions', async (req, res, next) => {
  try {
    const positions = await prisma.openPosition.findMany({
      orderBy: { order: 'asc' },
      select: { titleFr: true, attachmentFr: true, statusFr: true },
    });
    res.json({ data: positions });
  } catch (error) {
    next(error);
  }
});

/**
 * The company structure, for the public organisation chart.
 *
 * Structural only, and the `select` is where that is enforced. Three columns present on
 * the table are deliberately NOT listed:
 *
 *   - `headOccupancy` / `headLabelFr` — which posts are unfilled.
 *   - `criticalNoteFr` — internal risk commentary ("sans responsable, la certification
 *     ISO 9001 est menacée"). Publishing that tells competitors and clients precisely
 *     where the company is exposed.
 *   - `staffingFr` — headcount composition per cell.
 *
 * Adding any of them here is a disclosure decision, not a formatting one. Archived units
 * are excluded so the chart shows the company as it stands today.
 */
router.get('/organization', async (req, res, next) => {
  try {
    const units = await prisma.organizationUnit.findMany({
      where: { archivedAt: null },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        nameFr: true,
        type: true,
        parentId: true,
        icon: true,
        descriptionFr: true,
      },
    });

    res.json({
      data: units,
      counts: units.reduce((acc, unit) => {
        acc[unit.type] = (acc[unit.type] ?? 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
