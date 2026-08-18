/**
 * The audit vocabulary (ADR-022, CDC v0.1 §15).
 *
 * An audit row answers who, when, what, before and after. The action list is closed so
 * that a report can group by it and so a new action is a deliberate addition rather than
 * a free-text string that nobody can query.
 */

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
  'role.permission_changed',
  'entity.created',
  'entity.updated',
  'entity.deleted',
  'entity.validated',
  'access.denied',
  'document.downloaded',
  'report.exported',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  /** Null when the actor is unknown — a failed login on an unrecognised e-mail. */
  actorId: string | null;
  /** Who was acting, as written at the time, so the row survives a rename. */
  actorLabel: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  before: unknown | null;
  after: unknown | null;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Fields that must never reach the audit trail, whatever the entity. A before/after
 * snapshot is written straight from the record, so the filter belongs here rather than
 * in each caller's memory.
 */
const REDACTED_FIELDS = new Set([
  'passwordHash',
  'password',
  'tokenHash',
  'token',
  'secret',
  'sessionSecret',
]);

/** Deep copy with secrets removed, ready to be stored as JSONB. */
export function redactForAudit(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactForAudit);
  if (value instanceof Date) return value.toISOString();

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_FIELDS.has(key) ? '[redacted]' : redactForAudit(item);
  }
  return output;
}
