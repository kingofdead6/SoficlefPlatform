import { canAnyScope } from '../../domain/auth/authorization.js';

/**
 * Who may see which document — the single definition of the rule.
 *
 * Extracted from routes/documents.routes.js so the assistant's documentary agent and the
 * library itself apply *the same* predicate. Two copies of a visibility rule drift, and the
 * copy that drifts is the one nobody is looking at: an assistant quietly answering from a
 * department-restricted procedure would be a leak with no page to notice it on.
 *
 *   - visibility "ALL"          — visible to anyone holding document:read.
 *   - visibility "DEPARTMENTS"  — visible only when the caller's own directionFr or serviceFr
 *                                 appears in the document's departmentsFr array.
 *
 * Anyone holding document:create (HR, ADMIN) bypasses the restriction entirely: a publisher
 * who cannot see what they published cannot manage it. That is returned as `null`, meaning
 * "no visibility clause at all" — callers spread `...(filter ?? {})` into their `where`.
 *
 * The department match is expressed with Prisma's `array_contains` on the Json column, so the
 * filter runs in Postgres rather than post-query (ADR-021).
 */
export function audienceFilter(user) {
  if (canAnyScope(user, 'create', 'document')) return null;

  const departments = [user.directionFr, user.serviceFr].filter(Boolean);

  // No department on the account: only "ALL" documents are visible. Without this branch an
  // empty `OR` would match nothing at all, hiding the public library from them too.
  if (departments.length === 0) return { visibility: 'ALL' };

  return {
    OR: [
      { visibility: 'ALL' },
      {
        AND: [
          { visibility: 'DEPARTMENTS' },
          { OR: departments.map((name) => ({ departmentsFr: { array_contains: name } })) },
        ],
      },
    ],
  };
}
