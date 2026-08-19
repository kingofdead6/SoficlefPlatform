import { describe, expect, it } from 'vitest';

import {
  InvalidTransitionError,
  availableActions,
  canTransition,
  mayEditInPlace,
  requiresNewVersion,
  transition,
  type JobDescriptionStatus,
} from '@/domain/workflow/job-description';

/**
 * CDC v0.1 §6.1's state machine and the §19.1 acceptance criterion that a validated job
 * description cannot be modified without creating a new version.
 */

describe('the happy path of §6.1', () => {
  it('runs draft → review → validated → archived', () => {
    expect(transition('DRAFT', 'submit').to).toBe('IN_REVIEW');
    expect(transition('IN_REVIEW', 'approve').to).toBe('VALIDATED');
    expect(transition('VALIDATED', 'archive').to).toBe('ARCHIVED');
  });

  it('sends a reviewed document back for correction and round again', () => {
    expect(transition('IN_REVIEW', 'request_changes').to).toBe('CHANGES_REQUESTED');
    expect(transition('CHANGES_REQUESTED', 'submit').to).toBe('IN_REVIEW');
  });

  it('reports the pair it moved between, so the audit row cannot guess', () => {
    expect(transition('DRAFT', 'submit')).toEqual({
      from: 'DRAFT',
      to: 'IN_REVIEW',
      action: 'submit',
    });
  });
});

describe('illegal transitions are refused', () => {
  it('cannot approve a draft that was never submitted for review', () => {
    expect(() => transition('DRAFT', 'approve')).toThrow(InvalidTransitionError);
  });

  it('cannot re-approve an already validated version', () => {
    expect(() => transition('VALIDATED', 'approve')).toThrow(InvalidTransitionError);
  });

  it('cannot resurrect an archived version', () => {
    for (const action of ['submit', 'approve', 'request_changes', 'reopen'] as const) {
      expect(() => transition('ARCHIVED', action)).toThrow(InvalidTransitionError);
    }
  });

  it('answers 409 rather than 500 — it is a conflict, not a crash', () => {
    try {
      transition('VALIDATED', 'submit');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as InvalidTransitionError).status).toBe(409);
    }
  });
});

describe('§19.1 — a validated version is immutable', () => {
  it('permits in-place editing only while the version is still being written', () => {
    expect(mayEditInPlace('DRAFT')).toBe(true);
    expect(mayEditInPlace('CHANGES_REQUESTED')).toBe(true);
  });

  it('forbids editing a validated, archived or under-review version in place', () => {
    for (const status of ['VALIDATED', 'ARCHIVED', 'IN_REVIEW'] as JobDescriptionStatus[]) {
      expect(mayEditInPlace(status), status).toBe(false);
      expect(requiresNewVersion(status), status).toBe(true);
    }
  });
});

describe('availableActions drives the buttons the UI offers', () => {
  it('offers exactly what the machine accepts, for every state', () => {
    const states: JobDescriptionStatus[] = [
      'DRAFT',
      'IN_REVIEW',
      'CHANGES_REQUESTED',
      'VALIDATED',
      'ARCHIVED',
    ];
    for (const state of states) {
      for (const action of availableActions(state)) {
        expect(canTransition(state, action), `${state} → ${action}`).toBe(true);
        expect(() => transition(state, action)).not.toThrow();
      }
    }
  });

  it('offers nothing at all on an archived version', () => {
    expect(availableActions('ARCHIVED')).toEqual([]);
  });
});
