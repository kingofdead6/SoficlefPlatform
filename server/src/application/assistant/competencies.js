import { canAnyScope } from '../../domain/auth/authorization.js';
import { listPositionsWithMatrix, loadPositionMatrix } from '../competency/matrix.js';
import { score, terms, topMatches } from './matching.js';

/**
 * Agent 5 — "what does this job require".
 *
 * Two passes, because the competency frame is reachable only through a position:
 *   1. rank the positions the caller may see (`listPositionsWithMatrix` applies their scope);
 *   2. load the matrix of the few that matched, and rank the competency rows inside them.
 *
 * The matrix is loaded **without `forUserId`**, so `loadPositionMatrix` resolves gaps against
 * the caller's own assessments and nobody else's. A manager wanting a recruit's gap analysis
 * uses the competency pages, where choosing a subject is explicit; an assistant is not the
 * place to make that choice implicitly.
 *
 * Declared `reads` (domain/assistant/agents.js): competency, job_description.
 */

const GAP_FR = {
  conforme: 'conforme',
  'a-developper': 'à développer',
  critique: 'écart critique',
  'non-evalue': 'non évaluée',
};

/** How many matched positions are worth opening. Each is one more matrix query. */
const MAX_POSITIONS = 3;

export async function retrieveCompetencies(user, question) {
  if (!canAnyScope(user, 'read', 'competency')) return { snippets: [], sources: [] };

  const questionTerms = terms(question);
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

  const positions = await listPositionsWithMatrix(user).catch(() => []);
  if (positions.length === 0) return { snippets: [], sources: [] };

  /*
   * Only positions that actually carry competency rows are worth opening: `listPositions-
   * WithMatrix` returns every visible position, most of which have an empty matrix, and
   * spending the three matrix queries on those means a question about a real competency
   * finds nothing while the frame that answers it is never loaded.
   */
  const withRows = positions.filter((position) => position.competencyCount > 0);
  if (withRows.length === 0) return { snippets: [], sources: [] };

  const positionHits = withRows
    .map((position) => ({
      position,
      score: score(`${position.positionTitleFr} ${position.positionCode ?? ''}`, questionTerms),
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score);

  /*
   * A question naming no position ("qu'est-ce qu'une compétence critique ?") should still be
   * answerable from the frame, so fall back to the positions that carry a matrix at all
   * rather than returning nothing — the competency rows inside them are then what has to
   * match, and if none does the pipeline says so.
   */
  const chosen = (positionHits.length > 0 ? positionHits.map((hit) => hit.position) : withRows).slice(
    0,
    MAX_POSITIONS,
  );

  const matrices = await Promise.all(
    chosen.map((position) =>
      loadPositionMatrix(user, { positionId: position.positionId }).catch(() => null),
    ),
  );

  const candidates = [];

  for (const matrix of matrices) {
    if (!matrix) continue;

    const positionWeight = score(
      `${matrix.positionTitleFr} ${matrix.positionCode ?? ''}`,
      questionTerms,
    );

    for (const row of matrix.rows) {
      const rowWeight = score(`${row.nameFr} ${row.familyFr ?? ''} ${row.code ?? ''}`, questionTerms);
      const weight = rowWeight + positionWeight;
      if (weight === 0) continue;

      const parts = [
        `${matrix.positionTitleFr} — ${row.nameFr}`,
        `niveau requis ${row.requiredLevel}/${matrix.maxLevel}`,
        row.mandatory ? 'compétence obligatoire' : 'compétence optionnelle',
        `état : ${GAP_FR[row.gap.status] ?? row.gap.status}`,
        row.familyFr ? `famille ${row.familyFr}` : null,
      ].filter(Boolean);

      candidates.push({
        score: weight,
        detail: parts.join(' · '),
        source: {
          kind: 'competency',
          id: row.competencyId,
          label: `${row.nameFr} · ${matrix.positionTitleFr}`,
          href: '/competencies',
        },
      });
    }
  }

  const best = topMatches(candidates);
  return { snippets: best, sources: best.map((candidate) => candidate.source) };
}
