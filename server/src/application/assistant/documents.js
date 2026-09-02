import { canAnyScope } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';
import { audienceFilter } from '../documents/audience.js';
import { score, terms, topMatches } from './matching.js';

/**
 * Agent 2 — "where do I find the leave policy".
 *
 * Retrieval over the document library *the caller can actually see*: `audienceFilter` is the
 * same predicate the library page applies, so a department-restricted procedure stays
 * restricted here. Sharing that one definition is the point — an assistant quietly answering
 * from a document its reader cannot open would be a leak with no page to notice it on.
 *
 * Declared `reads` (domain/assistant/agents.js): document. Nothing else is queried.
 */
export async function retrieveDocuments(user, question) {
  // Gated the same way as GET /documents. Silence rather than a throw: the pipeline above
  // treats "no permission" and "no match" alike — neither produces an answer.
  if (!canAnyScope(user, 'read', 'document')) return { snippets: [], sources: [] };

  const questionTerms = terms(question);
  if (questionTerms.length === 0) return { snippets: [], sources: [] };

  const scoped = audienceFilter(user);

  const documents = await prisma.document
    .findMany({
      where: { ...(scoped ?? {}) },
      orderBy: [{ availability: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        slug: true,
        titleFr: true,
        detailFr: true,
        availability: true,
        fileName: true,
      },
    })
    .catch(() => []);

  const candidates = [];

  for (const doc of documents) {
    const weight = score(`${doc.titleFr} ${doc.detailFr ?? ''} ${doc.slug ?? ''}`, questionTerms);
    if (weight === 0) continue;

    // "Published but not yet uploaded" is worth saying: the reader should not go hunting for
    // a file that is not there yet.
    const state =
      doc.availability === 'AVAILABLE'
        ? (doc.fileName ?? 'document disponible')
        : 'en attente de publication';

    candidates.push({
      score: weight,
      detail: `${doc.titleFr} — ${doc.detailFr ?? 'Aucun détail renseigné'} (${state})`,
      source: { kind: 'document', id: doc.id, label: doc.titleFr, href: '/documents' },
    });
  }

  const best = topMatches(candidates);
  return { snippets: best, sources: best.map((candidate) => candidate.source) };
}
