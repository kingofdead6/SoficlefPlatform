import 'server-only';

import type { AuthenticatedUser } from '@/domain/auth/authorization';
import { audit } from '@/infrastructure/repositories/audit-repository';
import { revokeSession } from '@/infrastructure/repositories/session-repository';

/** Logging out revokes the session server-side, not merely the cookie client-side. */
export async function logout(
  user: AuthenticatedUser,
  sessionId: string,
  context: { ip: string | null; userAgent: string | null },
): Promise<void> {
  await revokeSession(sessionId);
  await audit({
    actorId: user.id,
    actorLabel: `${user.displayName} <${user.email}>`,
    action: 'auth.logout',
    entityType: 'session',
    entityId: sessionId,
    before: null,
    after: null,
    ip: context.ip,
    userAgent: context.userAgent,
  });
}
