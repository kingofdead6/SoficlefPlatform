import { describe, expect, it } from 'vitest';

import { computeGap, summarize } from '@/domain/competency/gap';

/**
 * CDC v0.1 §7 "Écart" — the gap calculation and its criticality bands, and §10's
 * roll-up. The scale is configurable, so the threshold is exercised too.
 */

describe('computeGap', () => {
  it('is conformant when the person meets the required level', () => {
    expect(computeGap({ requiredLevel: 3, actualLevel: 3 })).toMatchObject({
      status: 'conforme',
      gap: 0,
    });
  });

  it('is conformant when the person exceeds it, and never reports a negative gap', () => {
    expect(computeGap({ requiredLevel: 2, actualLevel: 4 })).toMatchObject({
      status: 'conforme',
      gap: 0,
    });
  });

  it('flags a one-rung shortfall as a development need', () => {
    expect(computeGap({ requiredLevel: 4, actualLevel: 3 })).toMatchObject({
      status: 'a-developper',
      gap: 1,
    });
  });

  it('flags a two-rung shortfall as critical', () => {
    expect(computeGap({ requiredLevel: 4, actualLevel: 2 })).toMatchObject({
      status: 'critique',
      gap: 2,
    });
  });

  it('distinguishes "never assessed" from "assessed at zero"', () => {
    expect(computeGap({ requiredLevel: 3, actualLevel: null }).status).toBe('non-evalue');
    expect(computeGap({ requiredLevel: 3, actualLevel: 0 }).status).toBe('critique');
  });

  it('honours a threshold matched to a different scale', () => {
    // On a 1–5 scale the business may only call three rungs critical.
    expect(computeGap({ requiredLevel: 5, actualLevel: 3 }, 3).status).toBe('a-developper');
    expect(computeGap({ requiredLevel: 5, actualLevel: 2 }, 3).status).toBe('critique');
  });
});

describe('summarize', () => {
  it('counts each band and rates conformity over assessed competencies only', () => {
    const summary = summarize([
      computeGap({ requiredLevel: 3, actualLevel: 3 }),
      computeGap({ requiredLevel: 3, actualLevel: 3 }),
      computeGap({ requiredLevel: 3, actualLevel: 2 }),
      computeGap({ requiredLevel: 4, actualLevel: 1 }),
      computeGap({ requiredLevel: 3, actualLevel: null }),
    ]);

    expect(summary).toMatchObject({
      total: 5,
      conforme: 2,
      aDevelopper: 1,
      critique: 1,
      nonEvalue: 1,
    });
    // 2 conformant out of the 4 that were assessed — the unassessed one is not counted
    // against the rate, which would otherwise read as a competency failure.
    expect(summary.conformityRate).toBe(50);
  });

  it('reports no rate rather than 0% when nothing has been assessed', () => {
    const summary = summarize([computeGap({ requiredLevel: 3, actualLevel: null })]);
    expect(summary.conformityRate).toBeNull();
  });

  it('handles an empty matrix', () => {
    expect(summarize([])).toMatchObject({ total: 0, conformityRate: null });
  });
});
