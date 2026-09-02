import { redactForAudit } from '../../domain/audit/actions.js';
import { prisma } from '../db/client.js';

/**
 * The audit writer. Callers pass the transaction they are already in, so the audit row
 * and the change it describes commit or roll back together.
 */
export async function writeAudit(tx, entry) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorLabel: entry.actorLabel,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before === null || entry.before === undefined ? undefined : redactForAudit(entry.before),
      after: entry.after === null || entry.after === undefined ? undefined : redactForAudit(entry.after),
      ip: entry.ip,
      userAgent: entry.userAgent,
    },
  });
}

/** Convenience for paths not already inside a transaction (login, logout). */
export async function audit(entry) {
  await writeAudit(prisma, entry);
}
