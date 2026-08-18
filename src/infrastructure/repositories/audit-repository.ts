import 'server-only';

import type { AuditEntry } from '@/domain/audit/actions';
import { redactForAudit } from '@/domain/audit/actions';

import { prisma } from '../db/client';
import type { PrismaClient } from '../db/generated/client';

/**
 * The audit writer (ADR-022).
 *
 * Callers pass the transaction they are already in, so the audit row and the change it
 * describes commit or roll back together — an audited change that did not happen, or a
 * change nobody can see, are both defects.
 *
 * There is no update and no delete here on purpose: the table is append-only from the
 * application's point of view.
 */
export type AuditWriter = Pick<PrismaClient, 'auditLog'>;

export async function writeAudit(tx: AuditWriter, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorLabel: entry.actorLabel,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: entry.before === null ? undefined : (redactForAudit(entry.before) as object),
      after: entry.after === null ? undefined : (redactForAudit(entry.after) as object),
      ip: entry.ip,
      userAgent: entry.userAgent,
    },
  });
}

/** Convenience for the paths that are not already inside a transaction (login, logout). */
export async function audit(entry: AuditEntry): Promise<void> {
  await writeAudit(prisma, entry);
}
