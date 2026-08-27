import 'server-only';

import { loadJourney, type JourneyTask } from '@/application/onboarding/journey';
import type { AuthenticatedUser } from '@/domain/auth/authorization';
import type { OnboardingTaskStatus } from '@/domain/onboarding/task';
import { prisma } from '@/infrastructure/db/client';

/**
 * One task of the caller's own journey, with its history.
 *
 * The history is read from the audit trail rather than from a second table of its own.
 * Every status change already goes through `mutate()`, which writes a before/after row in
 * the same transaction (ADR-022) — so the trail is complete by construction, and a
 * parallel history table could only ever disagree with it.
 */

export interface TaskHistoryEntry {
  at: Date;
  actorLabel: string;
  from: OnboardingTaskStatus | null;
  to: OnboardingTaskStatus;
}

export interface TaskDetail {
  instanceId: string;
  task: JourneyTask;
  /** The task before and after this one, for step-by-step navigation. */
  previousId: string | null;
  nextId: string | null;
  history: TaskHistoryEntry[];
}

/** Reads a status out of an audit row's JSON payload without trusting its shape. */
function statusIn(payload: unknown): OnboardingTaskStatus | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).status;
  return typeof value === 'string' ? (value as OnboardingTaskStatus) : null;
}

export async function loadTaskDetail(
  user: AuthenticatedUser,
  milestoneId: string,
): Promise<TaskDetail | null> {
  // Reuse the journey loader rather than querying the task directly: it already applies
  // the scope rules, so there is no second place where "may I see this" is decided.
  const journey = await loadJourney(user);
  if (!journey) return null;

  const index = journey.tasks.findIndex((candidate) => candidate.milestoneId === milestoneId);
  if (index === -1) return null;

  const task = journey.tasks[index];

  /*
   * History is keyed on the completion row, which only exists once something has happened
   * to the task. A task nobody has touched has no history, which is correct — not an
   * empty state to apologise for.
   */
  const history: TaskHistoryEntry[] = [];

  if (task.completionId) {
    const rows = await prisma.auditLog.findMany({
      where: { entityType: 'onboarding_task', entityId: task.completionId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, actorLabel: true, before: true, after: true },
    });

    for (const row of rows) {
      const to = statusIn(row.after);
      if (!to) continue;
      history.push({
        at: row.createdAt,
        actorLabel: row.actorLabel,
        from: statusIn(row.before),
        to,
      });
    }
  }

  return {
    instanceId: journey.instanceId,
    task,
    previousId: index > 0 ? journey.tasks[index - 1].milestoneId : null,
    nextId:
      index < journey.tasks.length - 1 ? journey.tasks[index + 1].milestoneId : null,
    history,
  };
}
