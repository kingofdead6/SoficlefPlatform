import { canAnyScope } from '../../domain/auth/authorization.js';
import { loadJourney } from '../onboarding/journey.js';
import { score, terms, topMatches } from './matching.js';
import { everyLanguage, formatDate, partSeparator, vocabulary } from './language.js';

/**
 * Agent 3 — "what is left on my checklist".
 *
 * **Self-scoped by construction.** `loadJourney(user)` is called with no `subjectUserId`, and
 * this function accepts no subject argument to pass one — there is deliberately no parameter
 * a route could thread a user id through. A manager asking here is answered about their own
 * journey, not a recruit's; the recruit's journey belongs to the manager pages, where the
 * perimeter check is visible and audited.
 *
 * Declared `reads` (domain/assistant/agents.js): onboarding_instance, onboarding_task.
 */

/**
 * Every language's word for each task status, so a question matches whichever one the reader
 * happened to type. Built once at module load — the table is constant.
 */
const STATUS_ALIASES = Object.fromEntries(
  ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'VALIDATED'].map((status) => [
    status,
    everyLanguage((words) => words.taskStatus[status]),
  ]),
);

export async function retrieveOnboarding(user, question, language) {
  const words = vocabulary(language);
  const separator = partSeparator(language);

  if (!canAnyScope(user, 'read', 'onboarding_task')) return { snippets: [], sources: [] };

  const questionTerms = terms(question);
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

  const journey = await loadJourney(user).catch(() => null);
  if (!journey) return { snippets: [], sources: [] };

  const candidates = [];

  for (const task of journey.tasks) {
    /*
     * The status is matched in every language, not only the one being answered in: someone
     * reading the Arabic interface still types "en retard" or "blocked" as often as not, and
     * a status word that only matches in the active language would drop their question.
     */
    const statusWord = words.taskStatus[task.status] ?? task.status;
    const statusAliases = STATUS_ALIASES[task.status] ?? '';

    const weight = score(
      `${task.titleFr} ${task.detailFr ?? ''} ${task.dayLabelFr ?? ''} ${task.phase ?? ''} ${statusAliases}`,
      questionTerms,
    );
    if (weight === 0) continue;

    const due = formatDate(task.dueDate, language);
    const timing = task.overdue ? words.overdue : task.dueSoon ? words.dueSoon : null;
    const parts = [
      `${task.titleFr} — ${statusWord}`,
      due ? `${words.due(due)}${timing ? ` (${timing})` : ''}` : null,
      task.phase ? words.phase(task.phase) : null,
      task.detailFr ? task.detailFr : null,
    ].filter(Boolean);

    candidates.push({
      score: weight,
      detail: parts.join(separator),
      source: {
        kind: 'onboarding_task',
        id: task.milestoneId,
        label: task.titleFr,
        href: '/app/me/journey',
      },
    });
  }

  const best = topMatches(candidates);
  return { snippets: best, sources: best.map((candidate) => candidate.source) };
}
