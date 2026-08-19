import { describe, expect, it } from 'vitest';

import {
  InvalidTaskTransitionError,
  assertTransition,
  dueDateFor,
  isCompleted,
  isDueSoon,
  isOverdue,
  progressOf,
  requiredActionFor,
  type OnboardingTaskStatus,
} from '@/domain/onboarding/task';

/** CDC v0.1 §8/§9's task states and the §19.1 "identifies late tasks" criterion. */

const TODAY = new Date('2026-06-20T10:00:00Z');
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('the §9 task lifecycle', () => {
  it('runs à faire → en cours → terminée → validée', () => {
    expect(() => assertTransition('TODO', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertTransition('IN_PROGRESS', 'DONE')).not.toThrow();
    expect(() => assertTransition('DONE', 'VALIDATED')).not.toThrow();
  });

  it('lets a task be blocked from any open state and unblocked again', () => {
    expect(() => assertTransition('TODO', 'BLOCKED')).not.toThrow();
    expect(() => assertTransition('IN_PROGRESS', 'BLOCKED')).not.toThrow();
    expect(() => assertTransition('BLOCKED', 'IN_PROGRESS')).not.toThrow();
  });

  it('lets somebody correct a mis-ticked task', () => {
    expect(() => assertTransition('DONE', 'TODO')).not.toThrow();
  });

  it('treats a no-op as legal rather than a conflict', () => {
    expect(() => assertTransition('DONE', 'DONE')).not.toThrow();
  });

  it('refuses to validate a task that was never completed', () => {
    for (const from of ['TODO', 'IN_PROGRESS', 'BLOCKED'] as OnboardingTaskStatus[]) {
      expect(() => assertTransition(from, 'VALIDATED'), from).toThrow(InvalidTaskTransitionError);
    }
  });

  it('only lets a validated task go back to completed, not straight to open', () => {
    expect(() => assertTransition('VALIDATED', 'DONE')).not.toThrow();
    expect(() => assertTransition('VALIDATED', 'TODO')).toThrow(InvalidTaskTransitionError);
  });

  it('answers 409 on an illegal move', () => {
    try {
      assertTransition('TODO', 'VALIDATED');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as InvalidTaskTransitionError).status).toBe(409);
    }
  });
});

describe('validation is a distinct permission', () => {
  it('requires validate for a sign-off and update for everything else', () => {
    expect(requiredActionFor('VALIDATED')).toBe('validate');
    for (const status of ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as OnboardingTaskStatus[]) {
      expect(requiredActionFor(status), status).toBe('update');
    }
  });
});

describe('lateness (§19.1)', () => {
  it('flags an unfinished task past its deadline', () => {
    expect(isOverdue({ status: 'TODO', dueDate: day('2026-06-19') }, TODAY)).toBe(true);
  });

  it('does not flag a task due today', () => {
    expect(isOverdue({ status: 'TODO', dueDate: day('2026-06-20') }, TODAY)).toBe(false);
  });

  it('never flags finished work, however old', () => {
    expect(isOverdue({ status: 'DONE', dueDate: day('2026-01-01') }, TODAY)).toBe(false);
    expect(isOverdue({ status: 'VALIDATED', dueDate: day('2026-01-01') }, TODAY)).toBe(false);
  });

  it('flags a blocked task past its deadline — blocked is not an excuse', () => {
    expect(isOverdue({ status: 'BLOCKED', dueDate: day('2026-06-01') }, TODAY)).toBe(true);
  });

  it('never flags a task with no deadline', () => {
    expect(isOverdue({ status: 'TODO', dueDate: null }, TODAY)).toBe(false);
  });

  it('warns before the deadline, and stops once it has passed', () => {
    expect(isDueSoon({ status: 'TODO', dueDate: day('2026-06-22') }, 3, TODAY)).toBe(true);
    expect(isDueSoon({ status: 'TODO', dueDate: day('2026-06-30') }, 3, TODAY)).toBe(false);
    // An already-late task is reported as late, not as "due soon".
    expect(isDueSoon({ status: 'TODO', dueDate: day('2026-06-01') }, 3, TODAY)).toBe(false);
  });
});

describe('progress', () => {
  it('counts completions, validations, blockages and late tasks', () => {
    const progress = progressOf(
      [
        { status: 'VALIDATED', dueDate: day('2026-06-08') },
        { status: 'DONE', dueDate: day('2026-06-10') },
        { status: 'BLOCKED', dueDate: day('2026-06-15') },
        { status: 'TODO', dueDate: day('2026-06-30') },
      ],
      TODAY,
    );

    expect(progress).toEqual({
      total: 4,
      completed: 2,
      validated: 1,
      blocked: 1,
      overdue: 1,
      percent: 50,
    });
  });

  it('reports 0% rather than NaN for an empty journey', () => {
    expect(progressOf([], TODAY).percent).toBe(0);
  });

  it('counts a validated task as completed', () => {
    expect(isCompleted('VALIDATED')).toBe(true);
    expect(isCompleted('DONE')).toBe(true);
    expect(isCompleted('BLOCKED')).toBe(false);
  });
});

describe('due dates are derived from the journey start', () => {
  it('offsets the start date by the milestone day', () => {
    expect(dueDateFor(day('2026-06-07'), 30).toISOString().slice(0, 10)).toBe('2026-07-07');
    expect(dueDateFor(day('2026-06-07'), 1).toISOString().slice(0, 10)).toBe('2026-06-08');
  });

  it('does not mutate the start date it was given', () => {
    const start = day('2026-06-07');
    dueDateFor(start, 30);
    expect(start.toISOString().slice(0, 10)).toBe('2026-06-07');
  });
});
