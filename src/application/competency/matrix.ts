import 'server-only';

import { computeGap, summarize, type GapResult } from '@/domain/competency/gap';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { scopeFilterFor } from '@/domain/auth/authorization';
import { prisma } from '@/infrastructure/db/client';

/**
 * Reads the job↔competency matrix for one job, with each row's gap resolved against the
 * latest assessment of a given person (CDC v0.1 §7.1).
 *
 * Scope is applied in the query (ADR-021): a manager asking for a job outside their
 * structures gets nothing back rather than a filtered-in-the-UI list.
 */

export interface MatrixRow {
  competencyId: string;
  code: string | null;
  nameFr: string;
  familyFr: string | null;
  requiredLevel: number;
  mandatory: boolean;
  notesFr: string | null;
  gap: GapResult;
  lastAssessedAt: Date | null;
}

export interface JobMatrix {
  jobId: string;
  jobCode: string;
  jobTitleFr: string;
  organizationUnitId: string | null;
  /** The configurable scale, so the UI never hardcodes a maximum. */
  maxLevel: number;
  rows: MatrixRow[];
  summary: ReturnType<typeof summarize>;
}

/** The scale's top rung. Falls back to 4 only when the scale table is empty. */
export async function maxCompetencyLevel(): Promise<number> {
  const top = await prisma.competencyLevel.findFirst({ orderBy: { value: 'desc' } });
  return top?.value ?? 4;
}

export async function loadJobMatrix(
  user: AuthenticatedUser,
  options: { jobId?: string; forUserId?: string } = {},
): Promise<JobMatrix | null> {
  const scope = scopeFilterFor(user, 'read', 'competency');
  if (scope.kind === 'none') return null;

  const job = await prisma.job.findFirst({
    where: {
      ...(options.jobId ? { id: options.jobId } : {}),
      archivedAt: null,
      // A unit-scoped reader only sees jobs anchored in their structures. `self` is not
      // an anchor for a job, so it falls through to the unrestricted branch below and is
      // constrained by the assessment subject instead.
      ...(scope.kind === 'units'
        ? { organizationUnitId: { in: scope.organizationUnitIds } }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, code: true, titleFr: true, organizationUnitId: true },
  });
  if (!job) return null;

  const [links, maxLevel] = await Promise.all([
    prisma.jobCompetency.findMany({
      where: { jobId: job.id, competency: { archivedAt: null } },
      include: { competency: { include: { family: true } } },
    }),
    maxCompetencyLevel(),
  ]);

  // One query for every assessment of the subject, newest first, then reduced to the
  // latest per competency — rather than a query per row.
  const subjectId = options.forUserId ?? user.id;
  const assessments = await prisma.assessment.findMany({
    where: { userId: subjectId, competencyId: { in: links.map((l) => l.competencyId) } },
    orderBy: { assessedAt: 'desc' },
    select: { competencyId: true, level: true, assessedAt: true },
  });

  const latest = new Map<string, { level: number; assessedAt: Date }>();
  for (const assessment of assessments) {
    if (!latest.has(assessment.competencyId)) {
      latest.set(assessment.competencyId, {
        level: assessment.level,
        assessedAt: assessment.assessedAt,
      });
    }
  }

  const rows: MatrixRow[] = links
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
        gap: computeGap({
          requiredLevel: link.requiredLevel,
          actualLevel: current?.level ?? null,
          mandatory,
        }),
        lastAssessedAt: current?.assessedAt ?? null,
      };
    })
    .sort((a, b) => {
      // Critical gaps first — the page exists to surface them, not to list an alphabet.
      const rank = { critique: 0, 'a-developper': 1, 'non-evalue': 2, conforme: 3 } as const;
      const byStatus = rank[a.gap.status] - rank[b.gap.status];
      return byStatus !== 0 ? byStatus : a.nameFr.localeCompare(b.nameFr, 'fr');
    });

  return {
    jobId: job.id,
    jobCode: job.code,
    jobTitleFr: job.titleFr,
    organizationUnitId: job.organizationUnitId,
    maxLevel,
    rows,
    summary: summarize(rows.map((row) => row.gap)),
  };
}
