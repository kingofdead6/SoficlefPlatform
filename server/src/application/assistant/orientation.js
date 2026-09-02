import { getVisibleTree } from '../../infrastructure/repositories/position-repository.js';
import { prisma } from '../../infrastructure/db/client.js';
import { score, terms, topMatches } from './matching.js';

/**
 * Agent 1 — "who do I talk to about X".
 *
 * Retrieval and ranking over rows the asking user may already see: their own visible slice
 * of the org chart, plus the published contact directory. The answer is assembled from those
 * rows and always names them, so the reader can check it.
 *
 * A language model may later rephrase what this returns (application/assistant/answer.js),
 * but it is never given the database and never chooses the sources — retrieval does both.
 *
 * The choice that matters: the search runs over `getVisibleTree(user)`, not over every post.
 * A collaborator asking "who handles recruitment" is answered from the people they are
 * actually entitled to see — which is both the correct privacy behaviour and a better
 * answer, since the nearest relevant person beats the most senior one.
 *
 * Declared `reads` (domain/assistant/agents.js): position, assignment, organization_unit.
 */
export async function retrieveOrientation(user, question) {
  const questionTerms = terms(question);

  // Nothing to search on: say so rather than returning the org chart's first row.
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

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

  const candidates = [];

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
      source: { kind: 'position', id: node.id, label: node.titleFr, href: '/organization' },
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

  const best = topMatches(candidates);
  return { snippets: best, sources: best.map((candidate) => candidate.source) };
}

/**
 * The pre-existing entry point, kept so `POST /assistant/orientation/ask` and any caller
 * expecting `{ agent, answer, sources }` keep working unchanged.
 *
 * No match returns null rather than a hedge, because a plausible-sounding guess is the one
 * failure mode that costs the user more than saying nothing: they act on it, and it was
 * invented.
 */
export async function answerOrientation(user, question) {
  const { snippets, sources } = await retrieveOrientation(user, question);
  if (snippets.length === 0) return { agent: 'orientation', answer: null, sources: [] };

  return {
    agent: 'orientation',
    answer: snippets.map((candidate) => candidate.detail).join('\n'),
    sources,
  };
}
