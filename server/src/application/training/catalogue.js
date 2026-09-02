import { assertCanAnyScope, scopeFilterFor } from '../../domain/auth/authorization.js';
import { bestScores, mandatoryTrainingComplete, toPublicQuestions } from '../../domain/training/quiz.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * The training catalogue. `correctOption` never leaves the server: every read below
 * either omits it or passes rows through `toPublicQuestions`, which strips it.
 * Ported from SoficlefPlatform src/application/training/catalogue.ts.
 */

export async function loadCatalogue(user) {
  assertCanAnyScope(user, 'read', 'training');

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
  const certifiedAt = new Map();
  for (const attempt of attempts) {
    if (attempt.certifiedAt && !certifiedAt.has(attempt.moduleId)) {
      certifiedAt.set(attempt.moduleId, attempt.certifiedAt);
    }
  }

  const entries = modules.map((row) => ({
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

/** One module with its lesson and its quiz — answers stripped. */
export async function loadModule(user, code) {
  assertCanAnyScope(user, 'read', 'training');

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

/** Training completion across the caller's perimeter — counts only, no individual answers. */
export async function loadTrainingCoverage(user) {
  const scope = scopeFilterFor(user, 'read', 'training');
  if (scope.kind === 'none') return { people: 0, fullyTrained: 0, rate: null };

  const where =
    scope.kind === 'self'
      ? { id: user.id }
      : scope.kind === 'units'
        ? { userRoles: { some: { scope: { organizationUnitId: { in: scope.organizationUnitIds } } } } }
        : { onboardingInstances: { some: {} } };

  const [people, modules] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, trainingAttempts: { select: { moduleId: true, passed: true, certifiedAt: true } } },
    }),
    prisma.trainingModule.findMany({ where: { archivedAt: null }, select: { id: true, isMandatory: true } }),
  ]);

  if (people.length === 0) return { people: 0, fullyTrained: 0, rate: null };

  const fullyTrained = people.filter((person) => mandatoryTrainingComplete(modules, person.trainingAttempts)).length;

  return { people: people.length, fullyTrained, rate: Math.round((fullyTrained / people.length) * 100) };
}
