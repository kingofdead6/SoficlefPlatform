/**
 * Training quizzes and certification (CDC-2026 Module 6).
 *
 * The grading rule is here, away from the route that calls it, for one reason: the
 * correct answers must never travel to the browser. A quiz graded client-side is a quiz
 * whose answers are in the page source, and a mandatory HSE certification that can be
 * passed by reading the DOM certifies nothing.
 *
 * Domain code: imports nothing (ADR-019).
 */

export interface QuizQuestion {
  id: string;
  correctOption: string;
}

/** What the browser is allowed to see: the prompt and the options, never the answer. */
export interface PublicQuestion {
  id: string;
  order: number;
  promptFr: string;
  options: { id: string; labelFr: string }[];
}

export interface QuizResult {
  /** 0–100. */
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  /** Which questions were answered wrongly, for the review screen. */
  wrongQuestionIds: string[];
}

/**
 * Grades an attempt.
 *
 * An unanswered question counts as wrong rather than being excluded, so somebody cannot
 * raise their percentage by skipping what they do not know — with exclusion, answering
 * one question correctly and leaving nine blank would score 100%.
 */
export function grade(
  questions: QuizQuestion[],
  answers: Record<string, string>,
  passingScore: number,
): QuizResult {
  const total = questions.length;

  if (total === 0) {
    // A module with no questions cannot be failed, and cannot certify anything either.
    return { score: 0, passed: false, correct: 0, total: 0, wrongQuestionIds: [] };
  }

  const wrongQuestionIds = questions
    .filter((question) => answers[question.id] !== question.correctOption)
    .map((question) => question.id);

  const correct = total - wrongQuestionIds.length;
  const score = Math.round((correct / total) * 100);

  return { score, passed: score >= passingScore, correct, total, wrongQuestionIds };
}

/** Strips the answers before a question set is sent to the browser. */
export function toPublicQuestions(
  questions: {
    id: string;
    order: number;
    promptFr: string;
    options: unknown;
  }[],
): PublicQuestion[] {
  return questions
    .map((question) => ({
      id: question.id,
      order: question.order,
      promptFr: question.promptFr,
      options: parseOptions(question.options),
    }))
    .sort((a, b) => a.order - b.order);
}

/**
 * Options are stored as JSON, so they arrive as `unknown` and are validated rather than
 * cast: a malformed row should render an empty option list, not crash the page.
 */
function parseOptions(raw: unknown): { id: string; labelFr: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const option = entry as Record<string, unknown>;
    if (typeof option.id !== 'string' || typeof option.labelFr !== 'string') return [];
    return [{ id: option.id, labelFr: option.labelFr }];
  });
}

export interface AttemptLike {
  moduleId: string;
  passed: boolean;
  certifiedAt: Date | null;
}

export interface ModuleLike {
  id: string;
  isMandatory: boolean;
}

/**
 * Has this person completed every mandatory module?
 *
 * §8.2's acceptance criteria count completed onboarding, and an onboarding with an
 * outstanding HSE certification is not complete.
 */
export function mandatoryTrainingComplete(
  modules: ModuleLike[],
  attempts: AttemptLike[],
): boolean {
  const passedModuleIds = new Set(
    attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.moduleId),
  );
  return modules
    .filter((module) => module.isMandatory)
    .every((module) => passedModuleIds.has(module.id));
}

/** The best attempt at each module — what a progress screen shows. */
export function bestScores(
  attempts: { moduleId: string; score: number; passed: boolean }[],
): Map<string, { score: number; passed: boolean }> {
  const best = new Map<string, { score: number; passed: boolean }>();
  for (const attempt of attempts) {
    const current = best.get(attempt.moduleId);
    if (!current || attempt.score > current.score) {
      best.set(attempt.moduleId, { score: attempt.score, passed: attempt.passed });
    }
  }
  return best;
}
