import { loadJourney } from '../onboarding/journey.js';
import { prisma } from '../../infrastructure/db/client.js';

/**
 * One task of the caller's own journey, with its history (drawn from the audit trail), the
 * comment thread and the acknowledgement record if one has been given.
 * Ported from SoficlefPlatform src/application/me/task-detail.ts, then extended for the
 * New Hire portal's task detail page (route guide §2.1) so that page needs one call.
 *
 * The comments and the signature are only ever loaded for a task that `loadJourney` already
 * returned for this caller — that is what scopes them. loadJourney resolves the subject from
 * `scopeFilterFor(user, 'read', 'onboarding_task')`, which is `self` for an EMPLOYEE, so a
 * recruit reaches their own thread and nobody else's without this file repeating the check.
 */

function statusIn(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload.status;
  return typeof value === 'string' ? value : null;
}

export async function loadTaskDetail(user, milestoneId) {
  const journey = await loadJourney(user);
  if (!journey) return null;

  const index = journey.tasks.findIndex((candidate) => candidate.milestoneId === milestoneId);
  if (index === -1) return null;

  const task = journey.tasks[index];

  const history = [];
  let comments = [];
  let signature = null;

  if (task.completionId) {
    const [rows, commentRows, signatureRow] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType: 'onboarding_task', entityId: task.completionId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, actorLabel: true, before: true, after: true },
      }),
      loadTaskComments(task.completionId),
      prisma.taskSignature.findUnique({
        where: { completionId_signerId: { completionId: task.completionId, signerId: journey.subjectUserId } },
        select: { id: true, signedAt: true, statementFr: true, signatureHash: true },
      }),
    ]);

    for (const row of rows) {
      const to = statusIn(row.after);
      if (!to) continue;
      history.push({ at: row.createdAt, actorLabel: row.actorLabel, from: statusIn(row.before), to });
    }

    comments = commentRows;
    signature = signatureRow;
  }

  return {
    instanceId: journey.instanceId,
    // Whose journey this is. Equal to the caller's own id for a SELF-scoped read; a manager
    // or HR reading a recruit's task sees the recruit's id here. The signature route uses it
    // to refuse a signature given on somebody else's behalf.
    subjectUserId: journey.subjectUserId,
    task,
    previousId: index > 0 ? journey.tasks[index - 1].milestoneId : null,
    nextId: index < journey.tasks.length - 1 ? journey.tasks[index + 1].milestoneId : null,
    history,
    comments,
    signature,
  };
}

/** The thread of one completion, oldest first. Callers must have resolved the task first. */
export async function loadTaskComments(completionId) {
  const rows = await prisma.taskComment.findMany({
    where: { completionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      bodyFr: true,
      createdAt: true,
      author: { select: { id: true, displayName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    bodyFr: row.bodyFr,
    createdAt: row.createdAt,
    authorId: row.author.id,
    authorLabel: row.author.displayName,
  }));
}
