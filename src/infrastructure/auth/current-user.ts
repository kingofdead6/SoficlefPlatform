import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import type { AuthenticatedUser } from '@/domain/auth/authorization';

import { resolveSession } from '../repositories/session-repository';
import { loadAuthenticatedUser } from '../repositories/user-repository';

import { SESSION_COOKIE } from './session-token';

export interface CurrentSession {
  sessionId: string;
  user: AuthenticatedUser;
}

/**
 * Resolves the signed-in user for the current request.
 *
 * Wrapped in React's `cache` so a page, its layout and the navigation builder share one
 * resolution per request rather than each hitting the database. The session row is still
 * read once per request, which is what makes revocation immediate (ADR-011).
 */
export const getCurrentSession = cache(async (): Promise<CurrentSession | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await resolveSession(token);
  if (!session.valid) return null;

  const user = await loadAuthenticatedUser(session.userId);
  if (!user || user.status !== 'ACTIVE') return null;

  return { sessionId: session.sessionId, user };
});

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  return (await getCurrentSession())?.user ?? null;
}
