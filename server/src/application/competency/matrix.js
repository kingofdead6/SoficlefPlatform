import { computeGap, summarize } from '../../domain/competency/gap.js';
import { scopeFilterFor } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * Reads the post<->competency matrix for one position, with each row's gap resolved
 * against the latest assessment of a given person.
 * Ported from SoficlefPlatform src/application/competency/matrix.ts.
 */

export async function maxCompetencyLevel() {
  const top = await prisma.competencyLevel.findFirst({ orderBy: { value: 'desc' } });
  return top?.value ?? 4;
}

export async function loadPositionMatrix(user, options = {}) {
  const scope = scopeFilterFor(user, 'read', 'competency');
  if (scope.kind === 'none') return null;

  const position = await prisma.position.findFirst({
    where: {
      ...(options.positionId ? { id: options.positionId } : {}),
      archivedAt: null,
      ...(scope.kind === 'units' ? { organizationUnitId: { in: scope.organizationUnitIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, code: true, titleFr: true, organizationUnitId: true },
  });
  if (!position) return null;

  const [links, maxLevel] = await Promise.all([
    prisma.jobCompetency.findMany({
      where: { positionId: position.id, competency: { archivedAt: null } },
      include: { competency: { include: { family: true } } },
    }),
    maxCompetencyLevel(),
  ]);

  const subjectId = options.forUserId ?? user.id;
  const assessments = await prisma.assessment.findMany({
    where: { userId: subjectId, competencyId: { in: links.map((l) => l.competencyId) } },
    orderBy: { assessedAt: 'desc' },
    select: { competencyId: true, level: true, assessedAt: true },
  });

  const latest = new Map();
  for (const assessment of assessments) {
    if (!latest.has(assessment.competencyId)) {
      latest.set(assessment.competencyId, { level: assessment.level, assessedAt: assessment.assessedAt });
    }
  }

  const rows = links
    .map((link) => {
      const current = latest.get(link.competencyId) ?? null;
      const mandatory = link.notesFr !== 'Optionnelle';
      return {
        competencyId: link.competencyId,
        code: link.competency.code,
        nameFr: link.competency.nameFr,
        familyFr: link.competency.family?.nameFr ?? link.competency.categoryFr ?? null,
        requiredLevel: link.requiredLevel,
        mandatory,
        notesFr: link.notesFr,
        gap: computeGap({ requiredLevel: link.requiredLevel, actualLevel: current?.level ?? null }),
        lastAssessedAt: current?.assessedAt ?? null,
      };
    })
    .sort((a, b) => {
      const rank = { critique: 0, 'a-developper': 1, 'non-evalue': 2, conforme: 3 };
      const byStatus = rank[a.gap.status] - rank[b.gap.status];
      return byStatus !== 0 ? byStatus : a.nameFr.localeCompare(b.nameFr, 'fr');
    });

  return {
    positionId: position.id,
    positionCode: position.code,
    positionTitleFr: position.titleFr,
    organizationUnitId: position.organizationUnitId,
    maxLevel,
    rows,
    summary: summarize(rows.map((row) => row.gap)),
  };
}

/** Every active position with a matrix, for the manager/HR list view. */
export async function listPositionsWithMatrix(user) {
  const scope = scopeFilterFor(user, 'read', 'competency');
  if (scope.kind === 'none') return [];

  const positions = await prisma.position.findMany({
    where: {
      archivedAt: null,
      ...(scope.kind === 'units' ? { organizationUnitId: { in: scope.organizationUnitIds } } : {}),
    },
    orderBy: { titleFr: 'asc' },
    select: {
      id: true,
      code: true,
      titleFr: true,
      organizationUnitId: true,
      _count: { select: { jobCompetencies: true } },
    },
  });

  return positions.map((position) => ({
    positionId: position.id,
    positionCode: position.code,
    positionTitleFr: position.titleFr,
    organizationUnitId: position.organizationUnitId,
    competencyCount: position._count.jobCompetencies,
  }));
}
