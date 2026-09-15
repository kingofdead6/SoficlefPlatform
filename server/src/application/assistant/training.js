import { canAnyScope } from '../../domain/auth/authorization.js';
import { loadCatalogue } from '../training/catalogue.js';
import { score, terms, topMatches } from './matching.js';
import { everyLanguage, partSeparator, vocabulary } from './language.js';

/**
 * Agent 4 — "what training must I complete".
 *
 * `loadCatalogue(user)` already returns the shared catalogue joined to *the caller's own*
 * attempts: their best score per module and whether they passed. No other person's results
 * are reachable from here, and none are requested — a training score is an evaluation, and
 * this agent reads exactly one person's, the asker's.
 *
 * Declared `reads` (domain/assistant/agents.js): training.
 */
/**
 * "obligatoire / mandatory / إجبارية" and its opposite, in one searchable string each.
 *
 * Matched in every language for the same reason the task statuses are: "which training is
 * mandatory?" is asked in whichever language the asker thinks in, not the one the interface
 * is set to.
 */
const MANDATORY_ALIASES = everyLanguage((words) => words.mandatoryKeyword);
const OPTIONAL_ALIASES = everyLanguage((words) => words.optionalKeyword);

export async function retrieveTraining(user, question, language) {
  const words = vocabulary(language);
  const separator = partSeparator(language);

  if (!canAnyScope(user, 'read', 'training')) return { snippets: [], sources: [] };

  const questionTerms = terms(question);
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

  const catalogue = await loadCatalogue(user).catch(() => null);
  if (!catalogue) return { snippets: [], sources: [] };

  const candidates = [];

  for (const entry of catalogue.entries) {
    const weight = score(
      `${entry.titleFr} ${entry.summaryFr ?? ''} ${entry.code ?? ''} ${
        entry.isMandatory ? MANDATORY_ALIASES : OPTIONAL_ALIASES
      }`,
      questionTerms,
    );
    if (weight === 0) continue;

    const status = entry.best
      ? words.bestScore(entry.best.score, entry.best.passed)
      : words.noAttempt;

    const parts = [
      `${entry.titleFr} (${entry.code})`,
      entry.isMandatory ? words.mandatoryModule : words.optionalModule,
      words.passingScore(entry.passingScore),
      status,
      entry.summaryFr ? entry.summaryFr : null,
    ].filter(Boolean);

    candidates.push({
      score: weight,
      detail: parts.join(separator),
      source: {
        kind: 'training',
        id: entry.id,
        label: entry.titleFr,
        href: '/app/me/training',
      },
    });
  }

  const best = topMatches(candidates);
  return { snippets: best, sources: best.map((candidate) => candidate.source) };
}
