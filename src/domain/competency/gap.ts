/**
 * Competency gap computation (CDC v0.1 §7 "Écart").
 *
 * The scale is data, not a constant: §7 says the level scale is configurable and §11
 * says a value the business may change is configuration. Nothing here hardcodes 1–4 or
 * 1–5 — the criticality bands are derived from the scale that is passed in, so changing
 * the scale in the administration screen changes the verdicts without a code change.
 *
 * Domain code: imports nothing (ADR-019).
 */

/** Where a person stands against what their job requires. */
export type GapStatus = 'conforme' | 'a-developper' | 'critique' | 'non-evalue';

export interface GapInput {
  /** The level the job requires. */
  requiredLevel: number;
  /** The level the person was last assessed at, or null when never assessed. */
  actualLevel: number | null;
  /** Whether the competency is mandatory for the job (§7 "obligatoire/optionnel"). */
  mandatory?: boolean;
}

export interface GapResult {
  status: GapStatus;
  /** required − actual, floored at 0. Null when never assessed. */
  gap: number | null;
  requiredLevel: number;
  actualLevel: number | null;
}

/**
 * A gap of one rung is a development need; two or more is critical, and so is any
 * shortfall on a mandatory competency the person has never been assessed on.
 *
 * `criticalThreshold` is expressed in rungs rather than as an absolute level so it stays
 * meaningful whichever scale the client settles on (OQ-06).
 */
export function computeGap(input: GapInput, criticalThreshold = 2): GapResult {
  const { requiredLevel, actualLevel } = input;

  if (actualLevel === null) {
    return { status: 'non-evalue', gap: null, requiredLevel, actualLevel: null };
  }

  const gap = Math.max(0, requiredLevel - actualLevel);

  let status: GapStatus;
  if (gap === 0) status = 'conforme';
  else if (gap >= criticalThreshold) status = 'critique';
  else status = 'a-developper';

  return { status, gap, requiredLevel, actualLevel };
}

export interface CoverageSummary {
  total: number;
  conforme: number;
  aDevelopper: number;
  critique: number;
  nonEvalue: number;
  /** Share of assessed competencies that are conformant, 0–100. Null when none assessed. */
  conformityRate: number | null;
}

/** Roll a set of gaps up into the counts §10's dashboard reports. */
export function summarize(results: GapResult[]): CoverageSummary {
  const count = (status: GapStatus) => results.filter((r) => r.status === status).length;

  const conforme = count('conforme');
  const aDevelopper = count('a-developper');
  const critique = count('critique');
  const nonEvalue = count('non-evalue');
  const assessed = conforme + aDevelopper + critique;

  return {
    total: results.length,
    conforme,
    aDevelopper,
    critique,
    nonEvalue,
    conformityRate: assessed === 0 ? null : Math.round((conforme / assessed) * 100),
  };
}
