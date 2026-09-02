import { resolveSession } from '../repositories/session-repository.js';
import { loadAuthenticatedUser } from '../repositories/user-repository.js';
import { SESSION_COOKIE } from './session-token.js';

/**
 * Resolves the signed-in user for an Express request from the session cookie.
 * Ported from infrastructure/auth/current-user.ts (React `cache()` dropped — no
 * request-scoped memoization primitive in Express; middleware sets req.user once instead).
 */
export async function getCurrentSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;

  const session = await resolveSession(token);
  if (!session.valid) return null;

  const user = await loadAuthenticatedUser(session.userId);
  if (!user || user.status !== 'ACTIVE') return null;

  return { sessionId: session.sessionId, user };
}

export async function getCurrentUser(req) {
  return (await getCurrentSession(req))?.user ?? null;
}
