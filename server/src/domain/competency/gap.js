/** Competency gap computation (ported from domain/competency/gap.ts). */

export function computeGap(input, criticalThreshold = 2) {
  const { requiredLevel, actualLevel } = input;

  if (actualLevel === null || actualLevel === undefined) {
    return { status: 'non-evalue', gap: null, requiredLevel, actualLevel: null };
  }

  const gap = Math.max(0, requiredLevel - actualLevel);

  let status;
  if (gap === 0) status = 'conforme';
  else if (gap >= criticalThreshold) status = 'critique';
  else status = 'a-developper';

  return { status, gap, requiredLevel, actualLevel };
}

export function summarize(results) {
  const count = (status) => results.filter((r) => r.status === status).length;

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
