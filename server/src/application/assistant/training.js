import { canAnyScope } from '../../domain/auth/authorization.js';
import { loadCatalogue } from '../training/catalogue.js';
import { score, terms, topMatches } from './matching.js';

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
export async function retrieveTraining(user, question) {
  if (!canAnyScope(user, 'read', 'training')) return { snippets: [], sources: [] };

  const questionTerms = terms(question);
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

  const catalogue = await loadCatalogue(user).catch(() => null);
  if (!catalogue) return { snippets: [], sources: [] };

  const candidates = [];

  for (const entry of catalogue.entries) {
    const weight = score(
      `${entry.titleFr} ${entry.summaryFr ?? ''} ${entry.code ?? ''} ${
        entry.isMandatory ? 'obligatoire' : 'facultatif'
      }`,
      questionTerms,
    );
    if (weight === 0) continue;

    const status = entry.best
      ? `votre meilleur score : ${entry.best.score} % — ${entry.best.passed ? 'validé' : 'non validé'}`
      : 'aucune tentative de votre part';

    const parts = [
      `${entry.titleFr} (${entry.code})`,
      entry.isMandatory ? 'module obligatoire' : 'module facultatif',
      `seuil de réussite ${entry.passingScore} %`,
      status,
      entry.summaryFr ? entry.summaryFr : null,
    ].filter(Boolean);

    candidates.push({
      score: weight,
      detail: parts.join(' · '),
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
