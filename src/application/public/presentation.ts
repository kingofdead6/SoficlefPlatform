import 'server-only';

import { prisma } from '@/infrastructure/db/client';

/**
 * The reads behind the anonymous pages.
 *
 * Everything the rest of the platform reads goes through `can()` against a session. These
 * queries have no caller to check, which is exactly why they are isolated here rather than
 * shared with the authenticated modules: each one names its columns explicitly, so
 * widening a page cannot silently widen what an anonymous visitor can see. Adding a field
 * to a table never adds it to a public page — somebody has to come here and type it.
 *
 * Nothing below touches a table carrying personal data: no user, no assessment, no remark,
 * no onboarding row, no audit entry, no contact directory. The material is the company's
 * own public presentation, already published on soficlef.com.
 */

export async function loadPublicCompany() {
  return prisma.company.findFirst({
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
      // The general manager's name is on the public site's own pages, but it is a named
      // person, so it stays out of the anonymous view: the platform has no reason to
      // republish an individual.
      activities: { orderBy: { order: 'asc' }, select: { labelFr: true, contentFr: true } },
    },
  });
}

/** The four pillars of the Charte de Management — the one genuinely trilingual content. */
export async function loadPublicValues() {
  return prisma.companyValue.findMany({
    orderBy: { rank: 'asc' },
    select: { rank: true, nameFr: true, nameAr: true, nameEn: true },
  });
}

export async function loadPublicStrategy() {
  return prisma.strategy.findFirst({
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
}

/**
 * Open positions. `statusFr` is included because "En cours" is what tells a candidate the
 * post is still open; nothing identifies a person, and a vacancy is by nature public.
 */
export async function loadPublicPositions() {
  return prisma.openPosition.findMany({
    orderBy: { order: 'asc' },
    select: { titleFr: true, attachmentFr: true, statusFr: true },
  });
}
