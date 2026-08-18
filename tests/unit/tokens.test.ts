import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The palette is client-approved (ADR-004). A drifted hex is a visual-identity defect
 * that a screenshot review would probably miss, so it is asserted.
 *
 * Should the client confirm the red/anthracite identity of CDC v0.1 §13 (OQ-22), this
 * test changes with the token file — deliberately, in one place.
 */
const tokens = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

const EXPECTED: Record<string, string> = {
  '--gold': '#8b6914',
  '--gold-light': '#b8890f',
  '--gold-accent': '#c9a84c',
  '--gold-dim': 'rgba(139, 105, 20, 0.1)',
  '--blue': '#1e4d8c',
  '--blue-dim': 'rgba(30, 77, 140, 0.1)',
  '--bg': '#f5f4f0',
  '--surface': '#ffffff',
  '--surface2': '#f0ede8',
  '--border': '#e0dbd4',
  '--green': '#1a7a4a',
  '--red': '#c0392b',
  '--text': '#1a1a1a',
  '--text-muted': '#555050',
  '--text-dim': '#999090',
  '--radius': '10px',
  '--sidebar-w': '268px',
  '--topbar-h': '52px',
};

describe('design tokens', () => {
  for (const [token, value] of Object.entries(EXPECTED)) {
    it(`${token} keeps the client-approved value ${value}`, () => {
      const declaration = new RegExp(
        `${token.replace(/-/g, '\\-')}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`,
      );
      expect(tokens).toMatch(declaration);
    });
  }

  it('declares the Arabic display and UI families, which Playfair cannot cover', () => {
    expect(tokens).toMatch(/--type-display-arabic:/);
    expect(tokens).toMatch(/--type-ui-arabic:/);
  });

  it('re-points the type families for the Arabic locale', () => {
    expect(tokens).toMatch(/\[lang='ar'\][\s\S]*--type-display: var\(--type-display-arabic\)/);
  });

  it('keeps the type tokens out of the --font-* namespace Tailwind owns', () => {
    // A theme key mapping --font-display onto a token of the same name is circular and
    // silently resolves to nothing, which shows up as a system serif on screen.
    expect(tokens).not.toMatch(/^\s*--font-(display|ui|mono):/m);
  });

  it('respects prefers-reduced-motion', () => {
    expect(tokens).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
