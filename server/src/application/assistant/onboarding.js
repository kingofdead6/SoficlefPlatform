import { canAnyScope } from '../../domain/auth/authorization.js';
import { loadJourney } from '../onboarding/journey.js';
import { score, terms, topMatches } from './matching.js';

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

const STATUS_FR = {
  TODO: 'à faire',
  IN_PROGRESS: 'en cours',
  DONE: 'terminée',
  BLOCKED: 'bloquée',
  VALIDATED: 'validée',
};

function frenchDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('fr-FR');
}

export async function retrieveOnboarding(user, question) {
  if (!canAnyScope(user, 'read', 'onboarding_task')) return { snippets: [], sources: [] };

  const questionTerms = terms(question);
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

  const journey = await loadJourney(user).catch(() => null);
  if (!journey) return { snippets: [], sources: [] };

  const candidates = [];

  for (const task of journey.tasks) {
    const weight = score(
      `${task.titleFr} ${task.detailFr ?? ''} ${task.dayLabelFr ?? ''} ${task.phase ?? ''} ${
        STATUS_FR[task.status] ?? task.status
      }`,
      questionTerms,
    );
    if (weight === 0) continue;

    const due = frenchDate(task.dueDate);
    const parts = [
      `${task.titleFr} — ${STATUS_FR[task.status] ?? task.status}`,
      due ? `échéance ${due}${task.overdue ? ' (en retard)' : task.dueSoon ? ' (bientôt)' : ''}` : null,
      task.phase ? `phase ${task.phase}` : null,
      task.detailFr ? task.detailFr : null,
    ].filter(Boolean);

    candidates.push({
      score: weight,
      detail: parts.join(' · '),
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
