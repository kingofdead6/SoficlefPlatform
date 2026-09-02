/** Training quiz grading (ported from domain/training/quiz.ts). Answers never sent to browser. */

export function grade(questions, answers, passingScore) {
  const total = questions.length;

  if (total === 0) {
    return { score: 0, passed: false, correct: 0, total: 0, wrongQuestionIds: [] };
  }

  const wrongQuestionIds = questions
    .filter((question) => answers[question.id] !== question.correctOption)
    .map((question) => question.id);

  const correct = total - wrongQuestionIds.length;
  const score = Math.round((correct / total) * 100);

  return { score, passed: score >= passingScore, correct, total, wrongQuestionIds };
}

export function toPublicQuestions(questions) {
  return questions
    .map((question) => ({
      id: question.id,
      order: question.order,
      promptFr: question.promptFr,
      options: parseOptions(question.options),
    }))
    .sort((a, b) => a.order - b.order);
}

function parseOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    if (typeof entry.id !== 'string' || typeof entry.labelFr !== 'string') return [];
    return [{ id: entry.id, labelFr: entry.labelFr }];
  });
}

export function mandatoryTrainingComplete(modules, attempts) {
  const passedModuleIds = new Set(
    attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.moduleId),
  );
  return modules.filter((module) => module.isMandatory).every((module) => passedModuleIds.has(module.id));
}

export function bestScores(attempts) {
  const best = new Map();
  for (const attempt of attempts) {
    const current = best.get(attempt.moduleId);
    if (!current || attempt.score > current.score) {
      best.set(attempt.moduleId, { score: attempt.score, passed: attempt.passed });
    }
  }
  return best;
}
