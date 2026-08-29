import { describe, expect, it } from 'vitest';

import { alertsFor, type RecruitCard } from '@/domain/manager/alerts';

/**
 * The manager's alert rules, as pure logic.
 *
 * `alertsFor` is deliberately separate from the query that feeds it, so the ordering and
 * the windows can be tested exhaustively without a database — the same split that lets
 * `can()` be tested this way.
 */

const day = (offset: number): Date => {
  const date = new Date('2026-06-15T00:00:00Z');
  date.setDate(date.getDate() + offset);
  return date;
};

const NOW = new Date('2026-06-15T09:00:00Z');

function recruit(over: Partial<RecruitCard> = {}): RecruitCard {
  return {
    userId: 'u1',
    displayName: 'AMRANI Sofiane',
    email: 'a@x.local',
    instanceId: 'i1',
    positionFr: 'Technicien',
    startDate: day(-30),
    dayNumber: 30,
    percent: 50,
    done: 5,
    total: 10,
    overdue: 0,
    blocked: 0,
    completed: false,
    evaluationsDue: [],
    ...over,
  };
}

describe('what reaches a manager as an alert', () => {
  it('says nothing when everything is on track', () => {
    expect(alertsFor([recruit()], NOW)).toEqual([]);
  });

  it('raises blockages and lateness', () => {
    const alerts = alertsFor([recruit({ blocked: 2, overdue: 1 })], NOW);
    expect(alerts.map((alert) => alert.kind)).toEqual(['blocked', 'overdue']);
    expect(alerts.every((alert) => alert.severity === 'red')).toBe(true);
  });

  it('puts blockages before lateness, and both before upcoming interviews', () => {
    /*
     * The order is the point of the panel. A blockage waits on somebody else and only a
     * manager can unstick it; lateness is the recruit's to catch up; an interview next
     * week is merely a diary entry.
     */
    const alerts = alertsFor(
      [
        recruit({
          blocked: 1,
          overdue: 1,
          evaluationsDue: [{ id: 'e1', milestone: 'Point J+30', dueDate: day(3) }],
        }),
      ],
      NOW,
    );
    expect(alerts.map((alert) => alert.kind)).toEqual(['blocked', 'overdue', 'evaluation']);
  });

  it('announces an interview a week ahead, not on the day', () => {
    const soon = alertsFor(
      [recruit({ evaluationsDue: [{ id: 'e1', milestone: 'Point J+30', dueDate: day(5) }] })],
      NOW,
    );
    expect(soon).toHaveLength(1);
    expect(soon[0].severity).toBe('blue');

    // Further out than a week it is not yet actionable, so it stays off the panel.
    const later = alertsFor(
      [recruit({ evaluationsDue: [{ id: 'e1', milestone: 'Point J+30', dueDate: day(20) }] })],
      NOW,
    );
    expect(later).toEqual([]);
  });

  it('keeps an overdue interview visible however late it gets', () => {
    /*
     * The regression this guards: a window written as "within seven days" in both
     * directions would silently drop a review that fell due two months ago — exactly the
     * one somebody needs reminding about.
     */
    const alerts = alertsFor(
      [recruit({ evaluationsDue: [{ id: 'e1', milestone: 'Point J+30', dueDate: day(-65) }] })],
      NOW,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('red');
    expect(alerts[0].detailFr).toContain('65');
  });

  it('says nothing about somebody whose journey is finished', () => {
    const alerts = alertsFor(
      [recruit({ completed: true, overdue: 3, blocked: 2 })],
      NOW,
    );
    expect(alerts).toEqual([]);
  });

  it('orders the worst first within a kind', () => {
    /*
     * Four evaluations, all overdue, all red. Without this the panel shows them in
     * whatever order the rows arrived, so a sixty-five-day delay sits below a five-day one
     * and reads as equally urgent.
     */
    const alerts = alertsFor(
      [
        recruit({
          userId: 'u1',
          instanceId: 'i1',
          evaluationsDue: [
            { id: 'e-short', milestone: 'Point J+90', dueDate: day(-5) },
            { id: 'e-long', milestone: 'Point J+30', dueDate: day(-65) },
            { id: 'e-mid', milestone: 'Point J+60', dueDate: day(-20) },
          ],
        }),
      ],
      NOW,
    );

    expect(alerts.map((alert) => alert.id)).toEqual(['eval-e-long', 'eval-e-mid', 'eval-e-short']);
  });

  it('still puts a blockage above a worse-scoring lateness', () => {
    // Severity orders *within* a kind; it never promotes a late task above a blockage.
    const alerts = alertsFor([recruit({ blocked: 1, overdue: 40 })], NOW);
    expect(alerts.map((alert) => alert.kind)).toEqual(['blocked', 'overdue']);
  });
});
