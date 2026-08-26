/**
 * Satisfaction surveys (CDC-2026 Module 9, and the score §10 reports).
 *
 * §9 fixes the milestones (J+7, J+30, J+60, J+90) and the five indicators, so both are
 * constants here rather than configuration: a survey whose questions vary per person
 * cannot be averaged across the organization, and an average across the organization is
 * exactly what §10 asks for.
 *
 * Domain code: imports nothing (ADR-019).
 */

/** The milestones of §9, in days after the journey starts. */
export const SURVEY_MILESTONES = [7, 30, 60, 90] as const;

export type SurveyMilestone = (typeof SURVEY_MILESTONES)[number];

export const SURVEY_INDICATORS = [
  'WELCOME_QUALITY',
  'SUPPORT_LEVEL',
  'ROLE_CLARITY',
  'MANAGER_RELATIONSHIP',
  'WORKING_CONDITIONS',
] as const;

export type SurveyIndicator = (typeof SURVEY_INDICATORS)[number];

/** The scale every indicator is scored on. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export function isValidScore(score: number): boolean {
  return Number.isInteger(score) && score >= SCORE_MIN && score <= SCORE_MAX;
}

export function isSurveyMilestone(day: number): day is SurveyMilestone {
  return (SURVEY_MILESTONES as readonly number[]).includes(day);
}

/** When a round falls due: the journey's start plus the milestone's offset. */
export function surveyDueDate(startDate: Date, dayOffset: number): Date {
  const due = new Date(startDate);
  due.setDate(due.getDate() + dayOffset);
  return due;
}

export interface RoundLike {
  dayOffset: number;
  dueDate: Date;
  answeredAt: Date | null;
}

/**
 * Is this round waiting to be answered?
 *
 * A round is only "open" once its date has arrived — sending J+90 on day one would
 * ask somebody to rate an accompaniment they have not received yet. Comparison is on
 * whole days, so a survey due today is open from the start of the day.
 */
export function isOpen(round: RoundLike, today: Date = new Date()): boolean {
  if (round.answeredAt) return false;
  return startOfDay(round.dueDate) <= startOfDay(today);
}

/** Open, and its date has passed — what the reminder job chases (§1.2 "automatiser les relances"). */
export function isOverdue(round: RoundLike, today: Date = new Date()): boolean {
  if (round.answeredAt) return false;
  return startOfDay(round.dueDate) < startOfDay(today);
}

function startOfDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface ScoredResponse {
  indicator: SurveyIndicator;
  score: number;
}

/**
 * The satisfaction percentage §10 and §8.2 report.
 *
 * A 1–5 scale is rescaled so that 1 reads as 0% and 5 as 100%, rather than 1 reading as
 * 20%. §8.2 sets an acceptance floor of 85%, and on the naive mapping a set of straight
 * 4s — genuinely good — would score 80% and fail. The floor is only meaningful against a
 * scale whose bottom is zero.
 */
export function satisfactionPercent(responses: ScoredResponse[]): number | null {
  const scores = responses.map((response) => response.score).filter(isValidScore);
  if (scores.length === 0) return null;

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(((mean - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100);
}

export interface IndicatorBreakdown {
  indicator: SurveyIndicator;
  /** Mean raw score on the 1–5 scale, or null when nobody has answered it. */
  average: number | null;
  /** The same figure as a 0–100 percentage. */
  percent: number | null;
  responses: number;
}

/** Per-indicator averages, so a low overall score can be traced to what caused it. */
export function breakdown(responses: ScoredResponse[]): IndicatorBreakdown[] {
  return SURVEY_INDICATORS.map((indicator) => {
    const scores = responses
      .filter((response) => response.indicator === indicator)
      .map((response) => response.score)
      .filter(isValidScore);

    if (scores.length === 0) {
      return { indicator, average: null, percent: null, responses: 0 };
    }

    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return {
      indicator,
      average: Math.round(mean * 10) / 10,
      percent: satisfactionPercent(scores.map((score) => ({ indicator, score }))),
      responses: scores.length,
    };
  });
}

/** Share of issued rounds that were answered, 0–100. Null when none were issued. */
export function responseRate(rounds: RoundLike[]): number | null {
  if (rounds.length === 0) return null;
  const answered = rounds.filter((round) => round.answeredAt !== null).length;
  return Math.round((answered / rounds.length) * 100);
}
