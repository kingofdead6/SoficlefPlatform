import 'server-only';

import { scopeFilterFor, type AuthenticatedUser } from '@/domain/auth/authorization';
import { computeGap, summarize } from '@/domain/competency/gap';
import { isOverdue, type OnboardingTaskStatus } from '@/domain/onboarding/task';
import {
  averageOnboardingDays,
  probation,
  sixMonthTurnover,
  volume,
  type JourneyRecord,
} from '@/domain/hr/indicators';
import { loadSatisfaction } from '@/application/survey/rounds';
import { loadTrainingCoverage } from '@/application/training/catalogue';
import { dueDateFor } from '@/domain/onboarding/task';
import { prisma } from '@/infrastructure/db/client';

/**
 * The role-aware dashboard's figures (CDC v0.1 §10).
 *
 * Every count is scoped: the same page shows a manager their structures and HR the whole
 * organization, because each query carries `scopeFilterFor()`'s predicate rather than
 * being filtered afterwards (ADR-021). A user who holds none of a permission gets null
 * for that block, and the block is not rendered — an empty "0" would read as a fact.
 */

export interface DashboardData {
  jobDescriptions: { total: number; validated: number; draft: number; coverage: number } | null;
  competencies: {
    total: number;
    critical: number;
    unassessed: number;
    conformity: number | null;
  } | null;
  onboarding: {
    journeys: number;
    overdueTasks: number;
    blockedTasks: number;
    averagePercent: number;
  } | null;
  validation: { pendingJobDescriptions: number } | null;
  quality: { unitsWithoutHead: number; jobsWithoutDescription: number } | null;
  /** CDC-2026 Module 10 — the HR performance indicators. */
  hr: {
    completionRate: number | null;
    averageOnboardingDays: number | null;
    confirmationRate: number | null;
    turnoverRate: number | null;
    turnoverCohort: number;
    satisfaction: number | null;
    trainingRate: number | null;
  } | null;
}

export async function loadDashboard(user: AuthenticatedUser): Promise<DashboardData> {
  const [jobDescriptions, competencies, onboarding, validation, quality, hr] = await Promise.all([
    jobDescriptionCoverage(user),
    competencyGaps(user),
    onboardingHealth(user),
    pendingValidation(user),
    dataQuality(user),
    hrIndicators(user),
  ]);

  return { jobDescriptions, competencies, onboarding, validation, quality, hr };
}

async function jobDescriptionCoverage(user: AuthenticatedUser) {
  if (scopeFilterFor(user, 'read', 'job_description').kind === 'none') return null;

  const [total, versions] = await Promise.all([
    prisma.jobDescription.count(),
    prisma.jobDescriptionVersion.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countOf = (status: string) =>
    versions.find((row) => row.status === status)?._count._all ?? 0;

  const validated = countOf('VALIDATED');

  return {
    total,
    validated,
    draft: countOf('DRAFT') + countOf('CHANGES_REQUESTED'),
    coverage: total === 0 ? 0 : Math.round((validated / total) * 100),
  };
}

async function competencyGaps(user: AuthenticatedUser) {
  const scope = scopeFilterFor(user, 'read', 'competency');
  if (scope.kind === 'none') return null;

  const links = await prisma.jobCompetency.findMany({
    where: {
      competency: { archivedAt: null },
      job: {
        archivedAt: null,
        ...(scope.kind === 'units'
          ? { organizationUnitId: { in: scope.organizationUnitIds } }
          : {}),
      },
    },
    select: { competencyId: true, requiredLevel: true },
  });
  if (links.length === 0) return { total: 0, critical: 0, unassessed: 0, conformity: null };

  // The dashboard reads gaps across everyone in scope, so the latest assessment per
  // (person, competency) is what counts — hence one query, reduced in memory, rather
  // than a correlated subquery per row.
  const assessments = await prisma.assessment.findMany({
    where: { competencyId: { in: links.map((link) => link.competencyId) } },
    orderBy: { assessedAt: 'desc' },
    select: { competencyId: true, userId: true, level: true },
  });

  const latest = new Map<string, number>();
  for (const assessment of assessments) {
    const key = `${assessment.userId}:${assessment.competencyId}`;
    if (!latest.has(key)) latest.set(key, assessment.level);
  }

  const subjects = [...new Set(assessments.map((assessment) => assessment.userId))];

  const results = links.flatMap((link) =>
    subjects.length === 0
      ? [computeGap({ requiredLevel: link.requiredLevel, actualLevel: null })]
      : subjects.map((subject) =>
          computeGap({
            requiredLevel: link.requiredLevel,
            actualLevel: latest.get(`${subject}:${link.competencyId}`) ?? null,
          }),
        ),
  );

  const summary = summarize(results);
  return {
    total: links.length,
    critical: summary.critique,
    unassessed: summary.nonEvalue,
    conformity: summary.conformityRate,
  };
}

async function onboardingHealth(user: AuthenticatedUser) {
  const scope = scopeFilterFor(user, 'read', 'onboarding_instance');
  if (scope.kind === 'none') return null;

  const instances = await prisma.onboardingInstance.findMany({
    where:
      scope.kind === 'self'
        ? { userId: user.id }
        : scope.kind === 'units'
          ? {
              user: {
                userRoles: {
                  some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } },
                },
              },
            }
          : {},
    include: {
      template: { select: { milestones: { select: { id: true, dayOffset: true } } } },
      taskCompletions: { select: { milestoneId: true, status: true, dueDate: true } },
    },
  });

  const now = new Date();
  let overdueTasks = 0;
  let blockedTasks = 0;
  const percentages: number[] = [];

  for (const instance of instances) {
    const byMilestone = new Map(
      instance.taskCompletions.map((completion) => [completion.milestoneId, completion]),
    );
    let done = 0;

    for (const milestone of instance.template.milestones) {
      const completion = byMilestone.get(milestone.id);
      const status = (completion?.status ?? 'TODO') as OnboardingTaskStatus;
      const dueDate = completion?.dueDate ?? dueDateFor(instance.startDate, milestone.dayOffset);

      if (status === 'DONE' || status === 'VALIDATED') done += 1;
      if (status === 'BLOCKED') blockedTasks += 1;
      if (isOverdue({ status, dueDate }, now)) overdueTasks += 1;
    }

    const total = instance.template.milestones.length;
    percentages.push(total === 0 ? 0 : Math.round((done / total) * 100));
  }

  return {
    journeys: instances.length,
    overdueTasks,
    blockedTasks,
    averagePercent:
      percentages.length === 0
        ? 0
        : Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length),
  };
}

async function pendingValidation(user: AuthenticatedUser) {
  // Only somebody who may validate needs a "waiting for you" figure.
  if (scopeFilterFor(user, 'validate', 'job_description').kind === 'none') return null;

  return {
    pendingJobDescriptions: await prisma.jobDescriptionVersion.count({
      where: { status: 'IN_REVIEW' },
    }),
  };
}

async function dataQuality(user: AuthenticatedUser) {
  const scope = scopeFilterFor(user, 'read', 'organization_unit');
  if (scope.kind === 'none' || scope.kind === 'self') return null;

  const unitFilter = scope.kind === 'units' ? { id: { in: scope.organizationUnitIds } } : {};

  const [unitsWithoutHead, jobsWithoutDescription] = await Promise.all([
    prisma.organizationUnit.count({
      where: { ...unitFilter, archivedAt: null, headOccupancy: 'VACANT' },
    }),
    prisma.job.count({
      where: {
        archivedAt: null,
        jobDescription: null,
        ...(scope.kind === 'units'
          ? { organizationUnitId: { in: scope.organizationUnitIds } }
          : {}),
      },
    }),
  ]);

  return { unitsWithoutHead, jobsWithoutDescription };
}

/**
 * CDC-2026 Module 10 — the HR performance indicators.
 *
 * Scoped like every other block: a manager's figures cover their structures, HR's cover
 * the organization. Each rate distinguishes "zero" from "not measurable", so an empty
 * cohort shows an em dash rather than a flattering 0%.
 */
async function hrIndicators(user: AuthenticatedUser): Promise<DashboardData['hr']> {
  const scope = scopeFilterFor(user, 'read', 'onboarding_instance');
  if (scope.kind === 'none') return null;

  const instances = await prisma.onboardingInstance.findMany({
    where:
      scope.kind === 'self'
        ? { userId: user.id }
        : scope.kind === 'units'
          ? {
              user: {
                userRoles: {
                  some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } },
                },
              },
            }
          : {},
    select: {
      startDate: true,
      completedAt: true,
      probationOutcome: true,
      outcomeRecordedAt: true,
      template: { select: { _count: { select: { milestones: true } } } },
      taskCompletions: { select: { status: true } },
    },
  });

  const journeys: JourneyRecord[] = instances.map((instance) => ({
    startDate: instance.startDate,
    completedAt: instance.completedAt,
    probationOutcome: instance.probationOutcome,
    outcomeRecordedAt: instance.outcomeRecordedAt,
    tasksTotal: instance.template._count.milestones,
    tasksDone: instance.taskCompletions.filter(
      (task) => task.status === 'DONE' || task.status === 'VALIDATED',
    ).length,
  }));

  const [satisfaction, training] = await Promise.all([
    loadSatisfaction(user).catch(() => null),
    loadTrainingCoverage(user).catch(() => null),
  ]);

  const turnover = sixMonthTurnover(journeys);

  return {
    completionRate: volume(journeys).completionRate,
    averageOnboardingDays: averageOnboardingDays(journeys),
    confirmationRate: probation(journeys).confirmationRate,
    turnoverRate: turnover.rate,
    turnoverCohort: turnover.cohort,
    satisfaction: satisfaction?.score ?? null,
    trainingRate: training?.rate ?? null,
  };
}
