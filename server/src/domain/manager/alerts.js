/** What reaches a manager as an alert (ported from domain/manager/alerts.ts). */

const daysBetween = (from, to) => {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
};

export function alertsFor(recruits, now = new Date()) {
  const alerts = [];

  for (const recruit of recruits) {
    if (recruit.completed) continue;

    if (recruit.blocked > 0) {
      alerts.push({
        id: `blocked-${recruit.instanceId}`,
        kind: 'blocked',
        severity: 'red',
        severityScore: recruit.blocked,
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
        severityScore: recruit.overdue,
        titleFr: `${recruit.displayName} — ${recruit.overdue} étape${recruit.overdue > 1 ? 's' : ''} en retard`,
        detailFr: 'Le parcours a dépassé une échéance.',
        href: `/app/manager/recruits/${recruit.userId}`,
      });
    }

    for (const evaluation of recruit.evaluationsDue) {
      const daysUntil = daysBetween(now, evaluation.dueDate);
      if (daysUntil > 7) continue;

      alerts.push({
        id: `eval-${evaluation.id}`,
        kind: 'evaluation',
        severity: daysUntil < 0 ? 'red' : 'blue',
        severityScore: -daysUntil,
        titleFr: `${recruit.displayName} — ${evaluation.milestone}`,
        detailFr:
          daysUntil < 0
            ? `En retard de ${Math.abs(daysUntil)} jour${Math.abs(daysUntil) > 1 ? 's' : ''}.`
            : daysUntil === 0
              ? "À faire aujourd'hui."
              : `Dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}.`,
        href: `/app/manager/evaluations/${evaluation.id}`,
      });
    }
  }

  const rank = { blocked: 0, overdue: 1, evaluation: 2 };
  return alerts.sort((a, b) => rank[a.kind] - rank[b.kind] || b.severityScore - a.severityScore);
}
