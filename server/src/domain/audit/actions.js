/** The audit vocabulary (ported from audit/actions.ts). */

export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.session_revoked',
  'auth.password_changed',
  'user.created',
  'user.updated',
  'user.status_changed',
  'user.role_assigned',
  'user.role_revoked',
  'user.role_assignment_denied',
  'user.assigned',
  'user.assignment_ended',
  'role.permission_changed',
  'entity.created',
  'entity.updated',
  'entity.deleted',
  'entity.validated',
  'access.denied',
  'document.downloaded',
  'report.exported',
];

const REDACTED_FIELDS = new Set([
  'passwordHash',
  'password',
  'tokenHash',
  'token',
  'secret',
  'sessionSecret',
]);

export function redactForAudit(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (value instanceof Date) return value.toISOString();

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = REDACTED_FIELDS.has(key) ? '[redacted]' : redactForAudit(item);
  }
  return output;
}
