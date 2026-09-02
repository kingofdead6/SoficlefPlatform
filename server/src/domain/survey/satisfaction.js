/** Satisfaction survey scoring (ported from domain/survey/satisfaction.ts). */

export const SURVEY_MILESTONES = [7, 30, 60, 90];

export const SURVEY_INDICATORS = [
  'WELCOME_QUALITY',
  'SUPPORT_LEVEL',
  'ROLE_CLARITY',
  'MANAGER_RELATIONSHIP',
  'WORKING_CONDITIONS',
];

export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export function isValidScore(score) {
  return Number.isInteger(score) && score >= SCORE_MIN && score <= SCORE_MAX;
}

export function isSurveyMilestone(day) {
  return SURVEY_MILESTONES.includes(day);
}

export function surveyDueDate(startDate, dayOffset) {
  const due = new Date(startDate);
  due.setDate(due.getDate() + dayOffset);
  return due;
}

function startOfDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isOpen(round, today = new Date()) {
  if (round.answeredAt) return false;
  return startOfDay(round.dueDate) <= startOfDay(today);
}

export function isOverdue(round, today = new Date()) {
  if (round.answeredAt) return false;
  return startOfDay(round.dueDate) < startOfDay(today);
}

export function satisfactionPercent(responses) {
  const scores = responses.map((response) => response.score).filter(isValidScore);
  if (scores.length === 0) return null;

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(((mean - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100);
}

export function breakdown(responses) {
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

export function responseRate(rounds) {
  if (rounds.length === 0) return null;
  const answered = rounds.filter((round) => round.answeredAt !== null).length;
  return Math.round((answered / rounds.length) * 100);
}
