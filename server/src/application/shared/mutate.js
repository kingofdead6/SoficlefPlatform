import { ForbiddenError, assertCan } from '../../domain/auth/authorization.js';
import { prisma } from '../../infrastructure/db/client.js';
import { writeAudit } from '../../infrastructure/repositories/audit-repository.js';

/**
 * The one place a route handler becomes an authenticated, validated, audited mutation.
 * Ported from application/shared/mutate.ts, adapted for Express (req replaces
 * next/headers(), getCurrentUser is passed in as req.user set by middleware).
 *
 *   authenticate -> re-validate with Zod -> authorize against the resolved target
 *                -> run and write the audit row, in one transaction
 */
export const ok = (data) => ({ ok: true, data });

function ipFromReq(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.headers['x-real-ip'] ?? req.socket?.remoteAddress ?? null;
}

export async function mutate(req, input, options) {
  const user = req.user;
  if (!user) return { ok: false, reason: 'unauthenticated' };

  const parsed = options.schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const value = parsed.data;

  let target;
  try {
    target = options.target ? await options.target(value, user) : undefined;
  } catch {
    return { ok: false, reason: 'not-found' };
  }

  try {
    assertCan(user, options.requires.action, options.requires.resource, target);
  } catch {
    return { ok: false, reason: 'forbidden' };
  }

  const ip = ipFromReq(req);
  const userAgent = req.headers['user-agent'] ?? null;

  try {
    const data = await prisma.$transaction(async (tx) => {
      const context = {
        user,
        tx,
        audit: (entry) =>
          writeAudit(tx, {
            actorId: user.id,
            actorLabel: user.displayName,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            before: entry.before ?? null,
            after: entry.after ?? null,
            ip,
            userAgent,
          }),
      };
      return options.run(value, context);
    });

    return { ok: true, data };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, reason: 'forbidden' };

    const status = error?.status;
    if (status === 409) return { ok: false, reason: 'conflict', message: error.message };
    if (status === 404) return { ok: false, reason: 'not-found' };

    console.error('Mutation failed:', error);
    return { ok: false, reason: 'unexpected' };
  }
}

/** Maps an ActionResult to an Express response. */
export function sendActionResult(res, result, successStatus = 200) {
  if (result.ok) return res.status(successStatus).json(result.data ?? { ok: true });

  const statusByReason = {
    unauthenticated: 401,
    forbidden: 403,
    invalid: 422,
    conflict: 409,
    'not-found': 404,
    unexpected: 500,
  };
  const status = statusByReason[result.reason] ?? 500;
  return res.status(status).json({
    error: result.reason,
    fieldErrors: result.fieldErrors,
    message: result.message,
  });
}
