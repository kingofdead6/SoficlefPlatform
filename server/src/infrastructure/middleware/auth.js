import { getCurrentSession } from '../auth/current-user.js';

/**
 * Attaches req.user / req.sessionId when a valid session cookie is present. Does not
 * itself reject — use requireAuth for routes that need a signed-in user.
 */
export async function attachUser(req, res, next) {
  try {
    const session = await getCurrentSession(req);
    req.user = session?.user ?? null;
    req.sessionId = session?.sessionId ?? null;
  } catch (error) {
    console.error('Failed to resolve session:', error);
    req.user = null;
    req.sessionId = null;
  }
  next();
}

/** The guard: no session -> 401. */
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  next();
}

/**
 * Mirrors the Next.js app's layout guard: an account with no post yet
 * (PENDING_ASSIGNMENT) is blocked from every route except the ones that explicitly
 * allow it (handled by the caller placing this middleware selectively).
 */
export function requireAssigned(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
  if (req.user.lifecycleState === 'PENDING_ASSIGNMENT') {
    return res.status(403).json({ error: 'pending-assignment' });
  }
  next();
}
