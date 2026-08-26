import { describe, expect, it } from 'vitest';

import {
  averageOnboardingDays,
  probation,
  sixMonthTurnover,
  volume,
  type JourneyRecord,
} from '@/domain/hr/indicators';
import {
  bestScores,
  grade,
  mandatoryTrainingComplete,
  toPublicQuestions,
} from '@/domain/training/quiz';
import {
  breakdown,
  isOpen,
  isOverdue,
  responseRate,
  satisfactionPercent,
  surveyDueDate,
  SURVEY_MILESTONES,
} from '@/domain/survey/satisfaction';

/** The domain rules behind CDC-2026's Modules 6, 9 and 10. */

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const TODAY = day('2026-06-20');

// ─── Module 9 — satisfaction surveys ────────────────────────────────────────

describe('survey milestones', () => {
  it('are the four the CDC fixes', () => {
    expect(SURVEY_MILESTONES).toEqual([7, 30, 60, 90]);
  });

  it('falls due at the journey start plus the offset', () => {
    expect(surveyDueDate(day('2026-06-07'), 30).toISOString().slice(0, 10)).toBe('2026-07-07');
  });

  it('does not mutate the start date it is given', () => {
    const start = day('2026-06-07');
    surveyDueDate(start, 90);
    expect(start.toISOString().slice(0, 10)).toBe('2026-06-07');
  });
});

describe('when a round is open', () => {
  it('is open once its date has arrived', () => {
    expect(isOpen({ dayOffset: 7, dueDate: day('2026-06-20'), answeredAt: null }, TODAY)).toBe(
      true,
    );
  });

  it('is not open before then — nobody can rate an accompaniment they have not had', () => {
    expect(isOpen({ dayOffset: 90, dueDate: day('2026-09-01'), answeredAt: null }, TODAY)).toBe(
      false,
    );
  });

  it('is closed once answered, however late', () => {
    const answered = { dayOffset: 7, dueDate: day('2026-01-01'), answeredAt: day('2026-01-05') };
    expect(isOpen(answered, TODAY)).toBe(false);
    expect(isOverdue(answered, TODAY)).toBe(false);
  });

  it('is overdue only after its date has passed, not on the day', () => {
    expect(isOverdue({ dayOffset: 7, dueDate: day('2026-06-20'), answeredAt: null }, TODAY)).toBe(
      false,
    );
    expect(isOverdue({ dayOffset: 7, dueDate: day('2026-06-19'), answeredAt: null }, TODAY)).toBe(
      true,
    );
  });
});

describe('the satisfaction score', () => {
  it('maps the bottom of the scale to 0% and the top to 100%', () => {
    expect(satisfactionPercent([{ indicator: 'WELCOME_QUALITY', score: 1 }])).toBe(0);
    expect(satisfactionPercent([{ indicator: 'WELCOME_QUALITY', score: 5 }])).toBe(100);
    expect(satisfactionPercent([{ indicator: 'WELCOME_QUALITY', score: 3 }])).toBe(50);
  });

  it('puts straight 4s above §8.2\'s 85% floor rather than below it', () => {
    // On a naive score/5 mapping this is 80% and fails acceptance, which would be wrong:
    // 4 out of 5 on every indicator is a good onboarding, not a failing one.
    const fours = [4, 4, 4, 4, 4].map((score) => ({ indicator: 'SUPPORT_LEVEL' as const, score }));
    expect(satisfactionPercent(fours)).toBe(75);
    expect(satisfactionPercent([{ indicator: 'SUPPORT_LEVEL', score: 5 }])).toBeGreaterThanOrEqual(
      85,
    );
  });

  it('reports nothing rather than 0% when nobody has answered', () => {
    expect(satisfactionPercent([])).toBeNull();
  });

  it('ignores scores outside the scale instead of averaging nonsense', () => {
    expect(
      satisfactionPercent([
        { indicator: 'ROLE_CLARITY', score: 5 },
        { indicator: 'ROLE_CLARITY', score: 99 },
      ]),
    ).toBe(100);
  });
});

describe('the indicator breakdown', () => {
  it('reports every indicator, including those nobody answered', () => {
    const rows = breakdown([{ indicator: 'WELCOME_QUALITY', score: 4 }]);
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.indicator === 'WELCOME_QUALITY')?.average).toBe(4);
    expect(rows.find((r) => r.indicator === 'MANAGER_RELATIONSHIP')?.average).toBeNull();
  });
});

describe('response rate', () => {
  it('is the answered share of issued rounds', () => {
    expect(
      responseRate([
        { dayOffset: 7, dueDate: day('2026-06-14'), answeredAt: day('2026-06-15') },
        { dayOffset: 30, dueDate: day('2026-07-07'), answeredAt: null },
      ]),
    ).toBe(50);
  });

  it('is null when none were issued', () => {
    expect(responseRate([])).toBeNull();
  });
});

// ─── Module 6 — training and quizzes ────────────────────────────────────────

const QUESTIONS = [
  { id: 'q1', correctOption: 'a' },
  { id: 'q2', correctOption: 'b' },
  { id: 'q3', correctOption: 'c' },
  { id: 'q4', correctOption: 'd' },
];

describe('quiz grading', () => {
  it('scores a perfect attempt at 100 and passes it', () => {
    const result = grade(QUESTIONS, { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }, 70);
    expect(result).toMatchObject({ score: 100, passed: true, correct: 4, total: 4 });
  });

  it('fails an attempt below the module’s passing score', () => {
    const result = grade(QUESTIONS, { q1: 'a', q2: 'x', q3: 'x', q4: 'x' }, 70);
    expect(result.score).toBe(25);
    expect(result.passed).toBe(false);
    expect(result.wrongQuestionIds).toEqual(['q2', 'q3', 'q4']);
  });

  it('counts an unanswered question as wrong, so skipping cannot raise the score', () => {
    // With exclusion this would be 100%: one right answer out of one attempted.
    expect(grade(QUESTIONS, { q1: 'a' }, 70).score).toBe(25);
  });

  it('passes exactly at the threshold, not just above it', () => {
    expect(grade(QUESTIONS, { q1: 'a', q2: 'b', q3: 'c', q4: 'x' }, 75).passed).toBe(true);
  });

  it('certifies nothing for a module with no questions', () => {
    expect(grade([], {}, 70)).toMatchObject({ score: 0, passed: false, total: 0 });
  });
});

describe('questions sent to the browser', () => {
  it('never carry the correct answer', () => {
    const published = toPublicQuestions([
      {
        id: 'q1',
        order: 1,
        promptFr: 'Quelle est la vitesse maximale sur le site ?',
        options: [
          { id: 'a', labelFr: '20 km/h' },
          { id: 'b', labelFr: '50 km/h' },
        ],
      },
    ]);
    expect(JSON.stringify(published)).not.toContain('correctOption');
    expect(published[0]?.options).toHaveLength(2);
  });

  it('survives a malformed options blob rather than crashing the page', () => {
    const published = toPublicQuestions([
      { id: 'q1', order: 1, promptFr: 'x', options: 'not an array' },
      { id: 'q2', order: 2, promptFr: 'y', options: [{ id: 'a' }] },
    ]);
    expect(published[0]?.options).toEqual([]);
    expect(published[1]?.options).toEqual([]);
  });

  it('returns the questions in their declared order', () => {
    const published = toPublicQuestions([
      { id: 'b', order: 2, promptFr: 'second', options: [] },
      { id: 'a', order: 1, promptFr: 'first', options: [] },
    ]);
    expect(published.map((q) => q.id)).toEqual(['a', 'b']);
  });
});

describe('mandatory training', () => {
  const modules = [
    { id: 'hse', isMandatory: true },
    { id: 'quality', isMandatory: true },
    { id: 'optional', isMandatory: false },
  ];

  it('is complete when every mandatory module has been passed', () => {
    expect(
      mandatoryTrainingComplete(modules, [
        { moduleId: 'hse', passed: true, certifiedAt: new Date() },
        { moduleId: 'quality', passed: true, certifiedAt: new Date() },
      ]),
    ).toBe(true);
  });

  it('is incomplete while one is outstanding, whatever the optional ones say', () => {
    expect(
      mandatoryTrainingComplete(modules, [
        { moduleId: 'hse', passed: true, certifiedAt: new Date() },
        { moduleId: 'optional', passed: true, certifiedAt: new Date() },
      ]),
    ).toBe(false);
  });

  it('does not count a failed attempt as a pass', () => {
    expect(
      mandatoryTrainingComplete(
        [{ id: 'hse', isMandatory: true }],
        [{ moduleId: 'hse', passed: false, certifiedAt: null }],
      ),
    ).toBe(false);
  });
});

describe('best scores', () => {
  it('keeps the highest attempt per module, so a retake cannot lower a result', () => {
    const best = bestScores([
      { moduleId: 'hse', score: 40, passed: false },
      { moduleId: 'hse', score: 90, passed: true },
      { moduleId: 'hse', score: 60, passed: false },
    ]);
    expect(best.get('hse')).toEqual({ score: 90, passed: true });
  });
});

// ─── Module 10 — HR indicators ──────────────────────────────────────────────

const journey = (over: Partial<JourneyRecord> = {}): JourneyRecord => ({
  startDate: day('2026-01-01'),
  completedAt: null,
  probationOutcome: 'ONGOING',
  outcomeRecordedAt: null,
  tasksTotal: 10,
  tasksDone: 5,
  ...over,
});

describe('volume indicators', () => {
  it('separates journeys in progress from those finished', () => {
    expect(
      volume([journey(), journey({ completedAt: day('2026-02-01') }), journey()]),
    ).toMatchObject({ total: 3, inProgress: 2, completed: 1 });
  });

  it('averages the completion rate across journeys', () => {
    expect(
      volume([journey({ tasksDone: 10 }), journey({ tasksDone: 0 })]).completionRate,
    ).toBe(50);
  });

  it('reports no rate rather than 0% for an empty organization', () => {
    expect(volume([]).completionRate).toBeNull();
  });
});

describe('average onboarding time', () => {
  it('counts only journeys that actually finished', () => {
    const days = averageOnboardingDays([
      journey({ startDate: day('2026-01-01'), completedAt: day('2026-01-31') }),
      // Still running: including it would drag the average down every single day.
      journey({ startDate: day('2026-01-01') }),
    ]);
    expect(days).toBe(30);
  });

  it('is null when nothing has finished yet', () => {
    expect(averageOnboardingDays([journey()])).toBeNull();
  });
});

describe('probation outcomes', () => {
  it('rates confirmation over decided probations, not over all of them', () => {
    const result = probation([
      journey({ probationOutcome: 'CONFIRMED' }),
      journey({ probationOutcome: 'RESIGNED' }),
      // Two still running: counting these as failures would start the rate at 0%.
      journey(),
      journey(),
    ]);
    expect(result).toMatchObject({ decided: 2, confirmed: 1, confirmationRate: 50 });
  });

  it('reports no rate while nothing has concluded', () => {
    expect(probation([journey(), journey()]).confirmationRate).toBeNull();
  });
});

describe('six-month turnover', () => {
  it('counts only people who started long enough ago to have had six months', () => {
    const result = sixMonthTurnover(
      [
        journey({ startDate: day('2025-06-01'), probationOutcome: 'RESIGNED', outcomeRecordedAt: day('2025-08-01') }),
        journey({ startDate: day('2025-06-01'), probationOutcome: 'CONFIRMED' }),
        // Started last month: including them would count them as "stayed" on no evidence.
        journey({ startDate: day('2026-05-20') }),
      ],
      TODAY,
    );
    expect(result).toMatchObject({ cohort: 2, departed: 1, rate: 50 });
  });

  it('ignores a departure recorded after the six-month window', () => {
    const result = sixMonthTurnover(
      [
        journey({
          startDate: day('2025-01-01'),
          probationOutcome: 'RESIGNED',
          // Left after fourteen months — not a six-month turnover event.
          outcomeRecordedAt: day('2026-03-01'),
        }),
      ],
      TODAY,
    );
    expect(result).toMatchObject({ cohort: 1, departed: 0, rate: 0 });
  });

  it('reports no rate rather than 0% for an empty cohort', () => {
    expect(sixMonthTurnover([journey({ startDate: day('2026-06-01') })], TODAY).rate).toBeNull();
  });
});
