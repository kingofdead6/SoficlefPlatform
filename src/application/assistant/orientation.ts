import 'server-only';

import type { AgentAnswer, AnswerSource } from '@/domain/assistant/agents';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { getVisibleTree } from '@/infrastructure/repositories/position-repository';
import { prisma } from '@/infrastructure/db/client';

/**
 * Agent 1 — "who do I talk to about X".
 *
 * **No LLM is called here** (ADR-003). This is retrieval and ranking over rows the asking
 * user may already see: their own visible slice of the org chart, plus the published
 * contact directory. The answer is assembled from those rows and always names them, so the
 * reader can check it.
 *
 * The choice that matters: the search runs over `getVisibleTree(user)`, not over every
 * post. A collaborator asking "who handles recruitment" is answered from the people they
 * are actually entitled to see — which is both the correct privacy behaviour and a better
 * answer, since the nearest relevant person beats the most senior one.
 */

/** Words carrying no signal; dropped before matching so "le responsable" ranks on "responsable". */
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'a', 'à', 'au', 'aux', 'et', 'ou',
  'qui', 'que', 'quoi', 'est', 'pour', 'dans', 'sur', 'avec', 'mon', 'ma', 'mes', 'je',
  'dois', 'faut', 'il', 'elle', 'contacter', 'parler', 'demander', 'voir', 'sais', 'pas',
  'the', 'who', 'what', 'is', 'for', 'to', 'my', 'i', 'should', 'about', 'do',
]);

/**
 * Normalises for comparison: lowercase, accents stripped, punctuation gone.
 *
 * Accent-stripping is not cosmetic here — "compétences" and "competences" must match, and
 * users type both.
 */
function normalise(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function terms(question: string): string[] {
  return normalise(question)
    .split(' ')
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * How well a candidate matches the question.
 *
 * Whole-word matches score above substring ones, so "RH" does not win on "acheteur"
 * containing the letters. A candidate matching nothing scores zero and is dropped rather
 * than shown as a weak guess.
 */
function score(haystack: string, questionTerms: string[]): number {
  const words = new Set(normalise(haystack).split(' '));
  let total = 0;
  for (const term of questionTerms) {
    if (words.has(term)) total += 3;
    else if (normalise(haystack).includes(term)) total += 1;
  }
  return total;
}

export async function answerOrientation(
  user: AuthenticatedUser,
  question: string,
): Promise<AgentAnswer> {
  const questionTerms = terms(question);

  // Nothing to search on: say so rather than returning the org chart's first row.
  if (questionTerms.length === 0) {
    return { agent: 'orientation', answer: null, sources: [] };
  }

  const [tree, contacts] = await Promise.all([
    getVisibleTree(user).catch(() => []),
    // The published directory. It carries no personal data beyond what the contacts page
    // already shows to every signed-in user.
    prisma.contact
      .findMany({
        select: { id: true, nameFr: true, roleFr: true, extension: true },
        orderBy: { order: 'asc' },
      })
      .catch(() => []),
  ]);

  const candidates: { source: AnswerSource; detail: string; score: number }[] = [];

  for (const node of tree) {
    // A vacant seat is a real answer to "who handles X" — "nobody, the post is open" is
    // more useful than silence, and it is what the occupancy note is for.
    const holder = node.holder?.displayName ?? node.occupancyFr ?? 'Poste vacant';
    const weight = score(`${node.titleFr} ${holder}`, questionTerms);
    if (weight === 0) continue;

    candidates.push({
      score: weight,
      detail: node.holder
        ? `${node.holder.displayName} — ${node.titleFr}`
        : `${node.titleFr} — ${node.occupancyFr ?? 'poste vacant'}`,
      source: {
        kind: 'position',
        id: node.id,
        label: node.titleFr,
        href: '/organization',
      },
    });
  }

  for (const contact of contacts) {
    const weight = score(`${contact.roleFr} ${contact.nameFr}`, questionTerms);
    if (weight === 0) continue;

    candidates.push({
      score: weight,
      detail: `${contact.nameFr} — ${contact.roleFr} (poste ${contact.extension})`,
      source: {
        kind: 'contact',
        id: contact.id,
        label: `${contact.nameFr} · ${contact.roleFr}`,
        href: '/contacts',
      },
    });
  }

  if (candidates.length === 0) {
    /*
     * No match. This returns null rather than a hedge, because a plausible-sounding guess
     * is the one failure mode that costs the user more than saying nothing: they act on
     * it, and it was invented.
     */
    return { agent: 'orientation', answer: null, sources: [] };
  }

  candidates.sort((a, b) => b.score - a.score);

  /*
   * Keep only what is nearly as good as the best match.
   *
   * Without this, "responsable HSE" answered correctly and then padded the answer with
   * every other "Responsable" in the tree, each scoring on that one shared word. Three
   * results are not better than one when two of them are wrong: the extras read as
   * alternatives, and the user has no way to tell which is which.
   */
  const top = candidates[0].score;
  const best = candidates.filter((candidate) => candidate.score >= top).slice(0, 3);

  return {
    agent: 'orientation',
    answer: best.map((candidate) => candidate.detail).join('\n'),
    sources: best.map((candidate) => candidate.source),
  };
}
