import 'server-only';

import { headers } from 'next/headers';
import type { z } from 'zod';

import {
  ForbiddenError,
  assertCan,
  type AuthenticatedUser,
  type TargetScope,
} from '@/domain/auth/authorization';
import type { Action, Resource } from '@/domain/auth/permissions';
import type { AuditAction } from '@/domain/audit/actions';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import { writeAudit } from '@/infrastructure/repositories/audit-repository';

/**
 * The one place a server action becomes an authenticated, validated, audited mutation.
 *
 * Every write in the application goes through here, which is what makes three rules
 * true by construction rather than by everybody remembering them:
 *
 *   - **Authorization** is decided by `can()` against the specific target, never by the
 *     fact that a form was rendered (ADR-020). A server action is a public POST endpoint;
 *     rendering is not a boundary.
 *   - **Input is re-validated** server-side with Zod even though the form validated
 *     (ADR-014).
 *   - **The audit row and the change share one transaction** (ADR-022), so an audited
 *     change that did not happen is impossible.
 *
 * Failures come back as a value rather than an exception: a server action's result is
 * rendered by `useActionState`, and a thrown error there becomes a blank error page
 * instead of a field-level message.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason: 'unauthenticated' | 'forbidden' | 'invalid' | 'conflict' | 'not-found' | 'unexpected';
      /** Field-level messages, keyed by field path, for an invalid payload. */
      fieldErrors?: Record<string, string[]>;
      message?: string;
    };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

/** A domain error that carries the HTTP-ish status the workflow modules already use. */
interface StatusError {
  status?: number;
  message?: string;
}

export interface MutationContext {
  user: AuthenticatedUser;
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
  /** Records an audit row inside this transaction. Call once per meaningful change. */
  audit: (entry: {
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    before?: unknown;
    after?: unknown;
  }) => Promise<void>;
}

export interface MutateOptions<TSchema extends z.ZodTypeAny, TResult> {
  /** The permission this mutation needs. */
  requires: { resource: Resource; action: Action };
  /**
   * The scope the permission is checked against. A function so it can be derived from
   * the parsed input — a manager may edit *their* structure, not any structure.
   *
   * The acting user is passed too, because a self-scoped resource (a remark, an
   * onboarding task of one's own) anchors on the actor rather than on the payload, and
   * a SELF assignment covers no row whose owner is not named.
   *
   * Omit only for a resource with no organizational anchor and no owner.
   */
  target?: (
    input: z.infer<TSchema>,
    user: AuthenticatedUser,
  ) => TargetScope | Promise<TargetScope>;
  schema: TSchema;
  run: (input: z.infer<TSchema>, context: MutationContext) => Promise<TResult>;
}

/**
 * Runs a mutation: authenticate → validate → authorize against the target → execute and
 * audit in one transaction.
 *
 * Authorization deliberately happens *after* validation, because the target scope is
 * usually derived from the payload; validating first means `can()` is asked about a
 * well-formed target rather than about `undefined`.
 */
export async function mutate<TSchema extends z.ZodTypeAny, TResult>(
  input: unknown,
  options: MutateOptions<TSchema, TResult>,
): Promise<ActionResult<TResult>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'unauthenticated' };

  const parsed = options.schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const value = parsed.data as z.infer<TSchema>;

  let target: TargetScope | undefined;
  try {
    target = options.target ? await options.target(value, user) : undefined;
  } catch {
    // A target resolver that cannot find its row answers not-found rather than leaking
    // that the id exists but is out of scope.
    return { ok: false, reason: 'not-found' };
  }

  if (!can(user, options.requires, target)) return { ok: false, reason: 'forbidden' };

  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? headerList.get('x-real-ip');
  const userAgent = headerList.get('user-agent');

  try {
    const data = await prisma.$transaction(async (tx) => {
      const context: MutationContext = {
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

    const status = (error as StatusError)?.status;
    if (status === 409) {
      return { ok: false, reason: 'conflict', message: (error as StatusError).message };
    }
    if (status === 404) return { ok: false, reason: 'not-found' };

    console.error('Mutation failed:', error);
    return { ok: false, reason: 'unexpected' };
  }
}

function can(
  user: AuthenticatedUser,
  requires: { resource: Resource; action: Action },
  target: TargetScope | undefined,
): boolean {
  try {
    assertCan(user, requires.action, requires.resource, target);
    return true;
  } catch {
    return false;
  }
}
