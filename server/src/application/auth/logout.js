import { audit } from '../../infrastructure/repositories/audit-repository.js';
import { revokeSession } from '../../infrastructure/repositories/session-repository.js';

export async function logout(user, sessionId, context) {
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
