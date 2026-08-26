import 'server-only';

import { assertCan, scopeFilterFor, type AuthenticatedUser } from '@/domain/auth/authorization';
import {
  bestScores,
  mandatoryTrainingComplete,
  toPublicQuestions,
  type PublicQuestion,
} from '@/domain/training/quiz';
import { prisma } from '@/infrastructure/db/client';

/**
 * The training catalogue (CDC-2026 Module 6).
 *
 * The one rule that shapes this file: `correctOption` never leaves the server. Every read
 * below either omits it or passes the rows through `toPublicQuestions`, which strips it.
 * A mandatory HSE certification that can be passed by reading the page source certifies
 * nothing.
 */

export interface CatalogueEntry {
  id: string;
  code: string;
  titleFr: string;
  summaryFr: string;
  isMandatory: boolean;
  passingScore: number;
  isPlaceholder: boolean;
  questionCount: number;
  /** This person's best result so far, if they have attempted it. */
  best: { score: number; passed: boolean } | null;
  certifiedAt: Date | null;
}

export interface CatalogueView {
  entries: CatalogueEntry[];
  mandatoryTotal: number;
  mandatoryPassed: number;
  allMandatoryComplete: boolean;
}

/** The catalogue with the caller's own progress against it. */
export async function loadCatalogue(user: AuthenticatedUser): Promise<CatalogueView> {
  // The target names the caller: the modules are shared reference content, but the
  // progress shown against them is theirs. A SELF-scoped assignment — what every
  // collaborator holds — covers no row unless the target says whose row it is.
  assertCan(user, 'read', 'training', { ownerUserId: user.id });

  const [modules, attempts] = await Promise.all([
    prisma.trainingModule.findMany({
      where: { archivedAt: null },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        code: true,
        titleFr: true,
        summaryFr: true,
        isMandatory: true,
        passingScore: true,
        isPlaceholder: true,
        _count: { select: { questions: true } },
      },
    }),
    prisma.trainingAttempt.findMany({
      where: { userId: user.id },
      select: { moduleId: true, score: true, passed: true, certifiedAt: true },
      orderBy: { startedAt: 'asc' },
    }),
  ]);

  const best = bestScores(attempts);
  const certifiedAt = new Map<string, Date>();
  for (const attempt of attempts) {
    if (attempt.certifiedAt && !certifiedAt.has(attempt.moduleId)) {
      certifiedAt.set(attempt.moduleId, attempt.certifiedAt);
    }
  }

  const entries: CatalogueEntry[] = modules.map((row) => ({
    id: row.id,
    code: row.code,
    titleFr: row.titleFr,
    summaryFr: row.summaryFr,
    isMandatory: row.isMandatory,
    passingScore: row.passingScore,
    isPlaceholder: row.isPlaceholder,
    questionCount: row._count.questions,
    best: best.get(row.id) ?? null,
    certifiedAt: certifiedAt.get(row.id) ?? null,
  }));

  const mandatory = entries.filter((entry) => entry.isMandatory);

  return {
    entries,
    mandatoryTotal: mandatory.length,
    mandatoryPassed: mandatory.filter((entry) => entry.best?.passed).length,
    allMandatoryComplete: mandatoryTrainingComplete(modules, attempts),
  };
}

export interface ModuleDetail {
  id: string;
  code: string;
  titleFr: string;
  summaryFr: string;
  contentFr: string;
  passingScore: number;
  isPlaceholder: boolean;
  questions: PublicQuestion[];
  best: { score: number; passed: boolean } | null;
}

/** One module with its lesson and its quiz — answers stripped. */
export async function loadModule(
  user: AuthenticatedUser,
  code: string,
): Promise<ModuleDetail | null> {
  assertCan(user, 'read', 'training', { ownerUserId: user.id });

  const record = await prisma.trainingModule.findFirst({
    where: { code, archivedAt: null },
    select: {
      id: true,
      code: true,
      titleFr: true,
      summaryFr: true,
      contentFr: true,
      passingScore: true,
      isPlaceholder: true,
      questions: {
        orderBy: { order: 'asc' },
        // `correctOption` is deliberately absent from this selection, so it cannot reach
        // the browser even if a future caller forgets to strip it.
        select: { id: true, order: true, promptFr: true, options: true },
      },
    },
  });
  if (!record) return null;

  const attempts = await prisma.trainingAttempt.findMany({
    where: { userId: user.id, moduleId: record.id },
    select: { moduleId: true, score: true, passed: true },
  });

  return {
    id: record.id,
    code: record.code,
    titleFr: record.titleFr,
    summaryFr: record.summaryFr,
    contentFr: record.contentFr,
    passingScore: record.passingScore,
    isPlaceholder: record.isPlaceholder,
    questions: toPublicQuestions(record.questions),
    best: bestScores(attempts).get(record.id) ?? null,
  };
}

/**
 * Training completion across the caller's perimeter — what §10's reporting and the
 * manager's follow-up view need. Counts only; no individual answers.
 */
export async function loadTrainingCoverage(user: AuthenticatedUser) {
  const scope = scopeFilterFor(user, 'read', 'training');
  if (scope.kind === 'none') return { people: 0, fullyTrained: 0, rate: null as number | null };

  const where =
    scope.kind === 'self'
      ? { id: user.id }
      : scope.kind === 'units'
        ? {
            userRoles: {
              some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } },
            },
          }
        : { onboardingInstances: { some: {} } };

  const [people, modules] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        trainingAttempts: { select: { moduleId: true, passed: true, certifiedAt: true } },
      },
    }),
    prisma.trainingModule.findMany({
      where: { archivedAt: null },
      select: { id: true, isMandatory: true },
    }),
  ]);

  if (people.length === 0) return { people: 0, fullyTrained: 0, rate: null };

  const fullyTrained = people.filter((person) =>
    mandatoryTrainingComplete(modules, person.trainingAttempts),
  ).length;

  return {
    people: people.length,
    fullyTrained,
    rate: Math.round((fullyTrained / people.length) * 100),
  };
}
