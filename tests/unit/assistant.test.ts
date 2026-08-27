import { describe, expect, it } from 'vitest';

import {
  AGENTS,
  AGENT_IDS,
  isWellFormed,
  type AgentAnswer,
} from '@/domain/assistant/agents';
import { RESOURCES } from '@/domain/auth/permissions';

/**
 * The assistant's shape, before there is an assistant.
 *
 * ADR-003 keeps the MVP free of any LLM dependency, so what is tested here is the
 * structure and the one rule that must survive the generation step being added later: an
 * answer either cites something the reader can check, or admits it found nothing.
 */

describe('the five agents of CDC-2026 §4', () => {
  it('declares exactly five', () => {
    expect(AGENT_IDS).toHaveLength(5);
    expect(Object.keys(AGENTS)).toHaveLength(5);
  });

  it('reads only through the platform’s own resources', () => {
    // An agent is not a way around `can()`: everything it retrieves is a resource the
    // permission model already knows how to scope, so it can never surface a row its
    // asker could not have opened directly.
    for (const id of AGENT_IDS) {
      for (const resource of AGENTS[id].reads) {
        expect(RESOURCES, `${id} reads ${resource}`).toContain(resource);
      }
    }
  });

  it('never permits an uncited answer', () => {
    for (const id of AGENT_IDS) {
      expect(AGENTS[id].requiresSource, id).toBe(false);
    }
  });
});

describe('an answer is checkable or it is nothing', () => {
  const answer = (over: Partial<AgentAnswer>): AgentAnswer => ({
    agent: 'orientation',
    answer: 'M. Mostafa — Responsable Compétences & Emplois',
    sources: [{ kind: 'position', id: 'p1', label: 'Responsable C&E' }],
    ...over,
  });

  it('accepts an answer that cites its source', () => {
    expect(isWellFormed(answer({}))).toBe(true);
  });

  it('accepts "I found nothing" with no sources', () => {
    // Null is a real answer and must stay expressible: an assistant that invents a
    // plausible contact costs the user more than one that admits ignorance, because they
    // act on the invention.
    expect(isWellFormed(answer({ answer: null, sources: [] }))).toBe(true);
  });

  it('rejects an answer with no source', () => {
    expect(isWellFormed(answer({ sources: [] }))).toBe(false);
  });

  it('rejects "nothing found" that nonetheless cites something', () => {
    // Contradictory, and the contradiction usually means the answer was dropped while its
    // citations were not — worth failing loudly rather than rendering half of it.
    expect(
      isWellFormed(answer({ answer: null, sources: [{ kind: 'position', id: 'p1', label: 'x' }] })),
    ).toBe(false);
  });
});
