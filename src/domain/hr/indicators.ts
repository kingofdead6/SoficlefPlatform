/**
 * The HR indicators of CDC-2026 Module 10.
 *
 * Three families: volume (recruitments, journeys in progress and finished, completion
 * rate), satisfaction (§9's score, filtered by direction and manager), and performance
 * (average time to onboard, probation confirmation rate, six-month turnover).
 *
 * Every figure here distinguishes "zero" from "not measurable". A turnover rate of 0%
 * across an empty cohort is not good news, it is an absent measurement, and a dashboard
 * that prints 0% in that case is lying quietly. Each function returns null instead, and
 * the UI renders an em dash.
 *
 * Domain code: imports nothing (ADR-019).
 */

export type ProbationOutcome =
  | 'ONGOING'
  | 'CONFIRMED'
  | 'EXTENDED'
  | 'TERMINATED'
  | 'RESIGNED';

export interface JourneyRecord {
  startDate: Date;
  completedAt: Date | null;
  probationOutcome: ProbationOutcome;
  outcomeRecordedAt: Date | null;
  /** Completed tasks over total tasks, for the completion rate. */
  tasksTotal: number;
  tasksDone: number;
}

export interface VolumeIndicators {
  total: number;
  inProgress: number;
  completed: number;
  /** Mean share of tasks done across every journey, 0–100. Null when there are none. */
  completionRate: number | null;
}

export function volume(journeys: JourneyRecord[]): VolumeIndicators {
  const completed = journeys.filter((journey) => journey.completedAt !== null).length;

  const rates = journeys
    .filter((journey) => journey.tasksTotal > 0)
    .map((journey) => (journey.tasksDone / journey.tasksTotal) * 100);

  return {
    total: journeys.length,
    inProgress: journeys.length - completed,
    completed,
    completionRate:
      rates.length === 0
        ? null
        : Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length),
  };
}

/**
 * Average days from a journey's start to its completion — §10's "temps moyen
 * d'onboarding".
 *
 * Only finished journeys count. Including the running ones would drag the average down
 * every day somebody is still onboarding, so the figure would improve simply by starting
 * new people, which is the opposite of what it should show.
 */
export function averageOnboardingDays(journeys: JourneyRecord[]): number | null {
  const finished = journeys.filter(
    (journey): journey is JourneyRecord & { completedAt: Date } => journey.completedAt !== null,
  );
  if (finished.length === 0) return null;

  const days = finished.map((journey) => daysBetween(journey.startDate, journey.completedAt));
  return Math.round(days.reduce((sum, day) => sum + day, 0) / days.length);
}

export interface ProbationIndicators {
  /** Journeys whose probation has actually concluded. */
  decided: number;
  confirmed: number;
  extended: number;
  terminated: number;
  resigned: number;
  /** Confirmed over decided, 0–100. Null while nothing has concluded. */
  confirmationRate: number | null;
}

/**
 * §10's "taux de validation définitive des périodes d'essai".
 *
 * The denominator is the *decided* journeys, not every journey: counting the ongoing ones
 * as failures would make the rate start at 0% and climb, which says nothing about how
 * well probations actually end.
 */
export function probation(journeys: JourneyRecord[]): ProbationIndicators {
  const count = (outcome: ProbationOutcome) =>
    journeys.filter((journey) => journey.probationOutcome === outcome).length;

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

/**
 * §10's "taux de turnover mesuré sur les 6 premiers mois".
 *
 * The cohort is everyone who started long enough ago to have had six months — including
 * somebody who started last week would count them as "stayed" on no evidence, which
 * flatters the figure. Departure is resignation or termination inside that window.
 */
export function sixMonthTurnover(
  journeys: JourneyRecord[],
  today: Date = new Date(),
): { cohort: number; departed: number; rate: number | null } {
  const WINDOW_DAYS = 182;

  const cohort = journeys.filter(
    (journey) => daysBetween(journey.startDate, today) >= WINDOW_DAYS,
  );

  const departed = cohort.filter((journey) => {
    if (journey.probationOutcome !== 'RESIGNED' && journey.probationOutcome !== 'TERMINATED') {
      return false;
    }
    // A departure recorded after the window belongs to a later period, not to this one.
    if (!journey.outcomeRecordedAt) return true;
    return daysBetween(journey.startDate, journey.outcomeRecordedAt) <= WINDOW_DAYS;
  }).length;

  return {
    cohort: cohort.length,
    departed,
    rate: cohort.length === 0 ? null : Math.round((departed / cohort.length) * 100),
  };
}

function daysBetween(from: Date, to: Date): number {
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day(to) - day(from)) / (24 * 60 * 60 * 1000));
}
