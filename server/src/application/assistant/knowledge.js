import { KNOWLEDGE } from '../../domain/assistant/knowledge.js';
import { score, terms, topMatches } from './matching.js';

/**
 * Retrieval over the curated platform knowledge base (domain/assistant/knowledge.js).
 *
 * Unlike the five agent retrievers this one reads no database and applies no scope filter,
 * because there is nothing personal in it: every entry describes the company, the
 * organisation or the product, and all of it is already on the public pages or the help text.
 * That is also why it is safe to consult for *any* agent.
 *
 * It is a **fallback**, not a peer: the pipeline tries the agent's own records first, and only
 * falls back here when they return nothing. A question about a real document should be
 * answered by that document, not by the paragraph describing the library.
 */
export async function retrieveKnowledge(_user, question) {
  const questionTerms = terms(question);
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

  const candidates = [];

  for (const entry of KNOWLEDGE) {
    /*
     * Title and keywords are weighted well above the prose, and the prose is only a
     * tie-breaker.
     *
     * Scoring the whole entry as one string let long entries win on incidental words: the
     * certification paragraph mentions « qualité » and « cellule » in passing, so it
     * outranked the vocabulary entry on "qu'est-ce qu'une cellule" and the training entry on
     * an Arabic question about mandatory courses. The keyword list is the part an editor
     * curates to say what an entry is *about*; the detail text is what it *says*.
     */
    const keyworded = score(`${entry.titleFr} ${entry.keywords.join(' ')}`, questionTerms);
    const prose = score(entry.detail, questionTerms);
    const weight = keyworded * 4 + prose;
    if (weight === 0) continue;

    candidates.push({
      score: weight,
      detail: entry.detail,
      source: {
        kind: 'knowledge',
        id: entry.id,
        label: entry.titleFr,
        href: entry.href ?? '/app',
      },
    });
  }

  const best = topMatches(candidates, 2);
  return { snippets: best, sources: best.map((candidate) => candidate.source) };
}
