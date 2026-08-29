/**
 * What reaches a manager as an alert, and in what order.
 *
 * Domain code: pure, no database, no framework (ADR-019). The rules are the interesting
 * part — which lateness matters, how far ahead an interview is worth announcing — so they
 * live where they can be tested exhaustively without standing up infrastructure, the same
 * way `can()` is.
 */

export interface RecruitCard {
  userId: string;
  displayName: string;
  email: string;
  instanceId: string;
  positionFr: string | null;
  startDate: Date;
  dayNumber: number;
  percent: number;
  done: number;
  total: number;
  overdue: number;
  blocked: number;
  completed: boolean;
  /** Reviews owed on this person, soonest first. */
  evaluationsDue: { id: string; milestone: string; dueDate: Date }[];
}

export interface ManagerAlert {
  id: string;
  kind: 'overdue' | 'blocked' | 'evaluation';
  severity: 'red' | 'blue';
  titleFr: string;
  detailFr: string;
  href: string;
}


const daysBetween = (from: Date, to: Date): number => {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
};

/** What needs the manager's attention, derived from the same rows the cards show. */
export function alertsFor(recruits: RecruitCard[], now: Date = new Date()): ManagerAlert[] {
  const alerts: ManagerAlert[] = [];

  for (const recruit of recruits) {
    if (recruit.completed) continue;

    if (recruit.blocked > 0) {
      alerts.push({
        id: `blocked-${recruit.instanceId}`,
        kind: 'blocked',
        severity: 'red',
        titleFr: `${recruit.displayName} — ${recruit.blocked} étape${recruit.blocked > 1 ? 's' : ''} bloquée${recruit.blocked > 1 ? 's' : ''}`,
        detailFr: 'Une étape bloquée attend une action extérieure au collaborateur.',
        href: `/app/manager/recruits/${recruit.userId}`,
      });
    }

    if (recruit.overdue > 0) {
      alerts.push({
        id: `overdue-${recruit.instanceId}`,
        kind: 'overdue',
        severity: 'red',
        titleFr: `${recruit.displayName} — ${recruit.overdue} étape${recruit.overdue > 1 ? 's' : ''} en retard`,
        detailFr: 'Le parcours a dépassé une échéance.',
        href: `/app/manager/recruits/${recruit.userId}`,
      });
    }

    for (const evaluation of recruit.evaluationsDue) {
      /*
       * A review is worth flagging shortly before it falls due, not only after. An
       * interview announced the morning it happens is one nobody prepared for.
       */
      const daysUntil = daysBetween(now, evaluation.dueDate);
      if (daysUntil > 7) continue;

      alerts.push({
        id: `eval-${evaluation.id}`,
        kind: 'evaluation',
        severity: daysUntil < 0 ? 'red' : 'blue',
        titleFr: `${recruit.displayName} — ${evaluation.milestone}`,
        detailFr:
          daysUntil < 0
            ? `En retard de ${Math.abs(daysUntil)} jour${Math.abs(daysUntil) > 1 ? 's' : ''}.`
            : daysUntil === 0
              ? 'À faire aujourd’hui.'
              : `Dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}.`,
        href: `/app/manager/evaluations/${evaluation.id}`,
      });
    }
  }

  // Blockages first, then lateness, then what is merely approaching.
  const rank = { blocked: 0, overdue: 1, evaluation: 2 };
  return alerts.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
