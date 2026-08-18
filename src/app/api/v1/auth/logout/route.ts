import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { logout } from '@/application/auth/logout';
import { SESSION_COOKIE } from '@/infrastructure/auth/session-token';
import { CSRF_COOKIE } from '@/infrastructure/security/csrf';
import { authenticated } from '@/infrastructure/http/route-handler';

/** POST /api/v1/auth/logout — revokes the session server-side, then clears the cookies. */
export const POST = authenticated(async ({ user, sessionId, context }) => {
  await logout(user, sessionId, context);

  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);

  return NextResponse.json({ ok: true });
});
