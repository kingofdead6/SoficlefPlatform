/**
 * The HR indicators (ported from domain/hr/indicators.ts). Every figure distinguishes
 * "zero" from "not measurable" — functions return null rather than 0 when there is
 * nothing to measure, and the UI should render an em dash for null.
 */

export function volume(journeys) {
  const completed = journeys.filter((journey) => journey.completedAt !== null).length;

  const rates = journeys
    .filter((journey) => journey.tasksTotal > 0)
    .map((journey) => (journey.tasksDone / journey.tasksTotal) * 100);

  return {
    total: journeys.length,
    inProgress: journeys.length - completed,
    completed,
    completionRate: rates.length === 0 ? null : Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length),
  };
}

export function averageOnboardingDays(journeys) {
  const finished = journeys.filter((journey) => journey.completedAt !== null);
  if (finished.length === 0) return null;

  const days = finished.map((journey) => daysBetween(journey.startDate, journey.completedAt));
  return Math.round(days.reduce((sum, day) => sum + day, 0) / days.length);
}

export function probation(journeys) {
  const count = (outcome) => journeys.filter((journey) => journey.probationOutcome === outcome).length;

  const confirmed = count('CONFIRMED');
  const extended = count('EXTENDED');
  const terminated = count('TERMINATED');
  const resigned = count('RESIGNED');
  const decided = confirmed + extended + terminated + resigned;

  return {
    decided,
    confirmed,
    extended,
    terminated,
    resigned,
    confirmationRate: decided === 0 ? null : Math.round((confirmed / decided) * 100),
  };
}

export function sixMonthTurnover(journeys, today = new Date()) {
  const WINDOW_DAYS = 182;

  const cohort = journeys.filter((journey) => daysBetween(journey.startDate, today) >= WINDOW_DAYS);

  const departed = cohort.filter((journey) => {
    if (journey.probationOutcome !== 'RESIGNED' && journey.probationOutcome !== 'TERMINATED') return false;
    if (!journey.outcomeRecordedAt) return true;
    return daysBetween(journey.startDate, journey.outcomeRecordedAt) <= WINDOW_DAYS;
  }).length;

  return {
    cohort: cohort.length,
    departed,
    rate: cohort.length === 0 ? null : Math.round((departed / cohort.length) * 100),
  };
}

function daysBetween(from, to) {
  const day = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day(to) - day(from)) / (24 * 60 * 60 * 1000));
}
