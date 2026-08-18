import 'server-only';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ForbiddenError, type AuthenticatedUser } from '@/domain/auth/authorization';
import { serverEnv } from '@/lib/env';

import { getCurrentSession } from '../auth/current-user';
import { CSRF_COOKIE, verifyCsrf } from '../security/csrf';
import { rateLimiter } from '../security/rate-limit';

/**
 * The one place an API route turns a request into an authenticated, CSRF-checked,
 * rate-limited call — so a new endpoint cannot forget one of the three.
 *
 * Authorization itself is *not* done here: it happens inside the handler, against the
 * specific target being acted on, through `can()` (ADR-020). A wrapper that granted
 * blanket access to "authenticated users" would be exactly the rule CDC v0.1 §3 forbids.
 */

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export function requestContext(request: Request): RequestContext {
  // Behind a reverse proxy the first hop of X-Forwarded-For is the client.
  const forwarded = request.headers.get('x-forwarded-for');
  return {
    ip: forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  };
}

export const unauthorized = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export const forbidden = () => NextResponse.json({ error: 'forbidden' }, { status: 403 });

export const notFound = () => NextResponse.json({ error: 'not_found' }, { status: 404 });

export const badRequest = (detail?: unknown) =>
  NextResponse.json({ error: 'bad_request', detail }, { status: 400 });

export const tooManyRequests = (resetAt: Date) =>
  NextResponse.json(
    { error: 'rate_limited' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))),
      },
    },
  );

interface HandlerArgs {
  request: Request;
  user: AuthenticatedUser;
  sessionId: string;
  context: RequestContext;
}

/**
 * Wraps an authenticated handler.
 *
 * Mutating requests additionally pass a CSRF check and a per-user rate limit
 * (CDC v0.1 §15). A `ForbiddenError` thrown by `assertCan()` anywhere below becomes a
 * 403 — the handler never has to remember to translate it.
 */
export function authenticated(
  handler: (args: HandlerArgs) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const session = await getCurrentSession();
    if (!session) return unauthorized();

    const method = request.method.toUpperCase();
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    if (isMutation) {
      const store = await cookies();
      const csrf = verifyCsrf({
        method,
        headers: request.headers,
        cookieToken: store.get(CSRF_COOKIE)?.value ?? null,
      });
      if (!csrf.ok)
        return NextResponse.json({ error: 'csrf', reason: csrf.reason }, { status: 403 });

      const limit = await rateLimiter.consume(
        `mutation:${session.user.id}`,
        serverEnv().AUTH_LOGIN_MAX_ATTEMPTS * 20,
        60,
      );
      if (!limit.allowed) return tooManyRequests(limit.resetAt);
    }

    try {
      return await handler({
        request,
        user: session.user,
        sessionId: session.sessionId,
        context: requestContext(request),
      });
    } catch (error) {
      if (error instanceof ForbiddenError) return forbidden();
      throw error;
    }
  };
}
