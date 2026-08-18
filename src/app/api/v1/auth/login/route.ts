import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { login } from '@/application/auth/login';
import { createCsrfToken, csrfCookieOptions, CSRF_COOKIE } from '@/infrastructure/security/csrf';
import { SESSION_COOKIE, sessionCookieOptions } from '@/infrastructure/auth/session-token';
import { requestContext, badRequest, tooManyRequests } from '@/infrastructure/http/route-handler';

/** POST /api/v1/auth/login */
export async function POST(request: Request): Promise<Response> {
  const context = requestContext(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('expected a JSON body');
  }

  const result = await login(body, context);

  if (!result.ok) {
    if (result.reason === 'rate-limited') return tooManyRequests(result.retryAfter ?? new Date());
    // One answer for a wrong password, an unknown e-mail and a disabled account, so the
    // endpoint cannot be used to enumerate accounts.
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
  store.set(CSRF_COOKIE, createCsrfToken(), csrfCookieOptions());

  return NextResponse.json({
    user: {
      id: result.user.id,
      displayName: result.user.displayName,
      locale: result.user.locale,
      roles: result.user.assignments.map((assignment) => assignment.role),
    },
  });
}
