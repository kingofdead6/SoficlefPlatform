/**
 * Trial-period (période d'essai) scoring and outcome suggestion.
 *
 * Pure domain module: no imports, no I/O, no Prisma — same convention as
 * domain/onboarding/task.js and domain/manager/alerts.js. Both the HR review queue
 * (server) and the review page (client, via THRESHOLDS) read their numbers from here so
 * the thresholds exist in exactly one place.
 *
 * What this module produces is a *suggestion*. It never decides anything: ending somebody's
 * trial period is a decision a human records, with a reason when it departs from the
 * arithmetic. See POST /onboarding/probation/decide.
 */

/** The four evaluation criteria, each scored 1–5 by the subject's responsable. */
export const SCORE_FIELDS = ['scoreSkills', 'scoreAutonomy', 'scoreIntegration', 'scoreBehaviour'];

/** Maximum attainable total: 4 criteria × 5 points. */
export const MAX_TOTAL = 20;

/**
 * Outcome thresholds, expressed as percentages of MAX_TOTAL.
 *
 *   percent > 60          → CONFIRMED  (confirmer le collaborateur)
 *   30 <= percent <= 60   → EXTENDED   (prolonger la période d'essai)
 *   percent < 30          → TERMINATED (mettre fin à la période d'essai)
 *
 * Both boundaries belong to EXTENDED: exactly 60% extends (it is not *above* 60), and
 * exactly 30% extends (it is not *below* 30). The code below matches that literally.
 */
export const THRESHOLDS = { confirmAbove: 60, extendFrom: 30, extendTo: 60 };

/**
 * The percentage a set of scores represents.
 *
 * Formula: (scoreSkills + scoreAutonomy + scoreIntegration + scoreBehaviour) / 20 * 100 —
 * the straightforward proportion of the maximum, NOT a rebased (total - 4) / 16 scale.
 * A perfect 20/20 is 100%; the arithmetic floor of 4/20 is 20%, which is below the 30%
 * line and therefore reads as TERMINATED, as intended.
 *
 * Returns null when any of the four scores is missing: a partially filled evaluation has
 * no percentage, and returning 0 for it would read as a catastrophic assessment.
 */
export function scorePercent(scores) {
  if (!scores) return null;

  let total = 0;
  for (const field of SCORE_FIELDS) {
    const value = scores[field];
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    total += numeric;
  }

  return Math.round((total / MAX_TOTAL) * 100);
}

/** The raw 4–20 total, or null when incomplete. Used for display beside the percentage. */
export function scoreTotal(scores) {
  if (!scores) return null;

  let total = 0;
  for (const field of SCORE_FIELDS) {
    const value = scores[field];
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    total += numeric;
  }

  return total;
}

/**
 * The ProbationOutcome the percentage suggests, or null when there is no percentage.
 * Values match the ProbationOutcome enum so the caller can write one straight through.
 */
export function suggestedOutcome(percent) {
  if (percent === null || percent === undefined || !Number.isFinite(Number(percent))) return null;

  const value = Number(percent);
  if (value > THRESHOLDS.confirmAbove) return 'CONFIRMED';
  if (value >= THRESHOLDS.extendFrom) return 'EXTENDED';
  return 'TERMINATED';
}

/** The outcomes HR may record from this screen. RESIGNED/ONGOING are not decisions here. */
export const DECIDABLE_OUTCOMES = ['CONFIRMED', 'EXTENDED', 'TERMINATED'];

/**
 * The evaluator's own recommendation (CONFIRM/EXTEND/TERMINATE) as a ProbationOutcome, so
 * HR can see at a glance whether the responsable agreed with the arithmetic.
 */
export function outcomeOfRecommendation(recommendation) {
  switch (recommendation) {
    case 'CONFIRM':
      return 'CONFIRMED';
    case 'EXTEND':
      return 'EXTENDED';
    case 'TERMINATE':
      return 'TERMINATED';
    default:
      return null;
  }
}
