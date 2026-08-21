import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * The palette is the visual identity (ADR-004). A drifted hex is a defect that a
 * screenshot review would probably miss, so it is asserted.
 *
 * The identity is red on white, per CDC v0.1 §13 (OQ-22 resolved in its favour). The
 * prototype's gold/sand palette that this file previously pinned is gone.
 */
const tokens = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

const EXPECTED: Record<string, string> = {
  '--red-brand': '#c8102e',
  '--red-strong': '#a00c24',
  '--red-deep': '#7f0a1d',
  '--red-light': '#e11d38',
  '--red-accent': '#f2879a',
  '--red-dim': 'rgba(200, 16, 46, 0.08)',
  '--red-veil': 'rgba(200, 16, 46, 0.16)',
  '--blue': '#1e4d8c',
  '--blue-dim': 'rgba(30, 77, 140, 0.09)',
  '--bg': '#fbfafa',
  '--surface': '#ffffff',
  '--surface2': '#f4f1f1',
  '--border': '#e6e0e1',
  '--green': '#116b41',
  '--red': '#8b0012',
  '--amber': '#8a5a00',
  '--text': '#171314',
  '--text-muted': '#4e4547',
  '--text-dim': '#6b6164',
  '--radius': '10px',
  '--sidebar-w': '268px',
  '--topbar-h': '52px',
};

describe('design tokens', () => {
  for (const [token, value] of Object.entries(EXPECTED)) {
    it(`${token} keeps the value ${value}`, () => {
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

  it('collapses every motion duration for a reader who asked for less movement', () => {
    // The engines read the same preference at runtime; this is the CSS half of that
    // promise, and it is worth pinning because a new duration token is easy to add and
    // easy to forget here.
    const reduced = tokens.slice(tokens.indexOf('prefers-reduced-motion'));
    for (const token of ['--transition', '--duration-fast', '--duration-base', '--duration-slow']) {
      expect(reduced, `${token} is not zeroed`).toMatch(
        new RegExp(`${token.replace(/-/g, '\\-')}:\\s*0ms;`),
      );
    }
  });
});

/**
 * Contrast, measured rather than trusted.
 *
 * A red identity is the case where this matters most: red is a dark hue that looks
 * confident at large sizes and fails quietly at 11px on a tinted background. These
 * assertions are what stop a future palette tweak from silently dropping the interface
 * below WCAG 2.1 AA.
 */
function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** `--red-dim` is translucent; this is what it resolves to over white. */
const RED_DIM_OVER_WHITE = '#fdedef';

describe('contrast (WCAG 2.1 AA)', () => {
  const AA_BODY = 4.5;

  const cases: [string, string, string, string][] = [
    ['brand red', EXPECTED['--red-brand'], 'white surface', EXPECTED['--surface']],
    ['brand red', EXPECTED['--red-brand'], 'app background', EXPECTED['--bg']],
    ['brand red', EXPECTED['--red-brand'], 'tinted surface', EXPECTED['--surface2']],
    ['brand red', EXPECTED['--red-brand'], 'red-dim over white', RED_DIM_OVER_WHITE],
    ['strong red', EXPECTED['--red-strong'], 'red-dim over white', RED_DIM_OVER_WHITE],
    ['critical red', EXPECTED['--red'], 'white surface', EXPECTED['--surface']],
    ['green', EXPECTED['--green'], 'white surface', EXPECTED['--surface']],
    ['amber', EXPECTED['--amber'], 'white surface', EXPECTED['--surface']],
    ['body text', EXPECTED['--text'], 'app background', EXPECTED['--bg']],
    ['muted text', EXPECTED['--text-muted'], 'app background', EXPECTED['--bg']],
    // The dim token carries 9–11px labels, which is exactly where a palette usually fails.
    ['dim text', EXPECTED['--text-dim'], 'app background', EXPECTED['--bg']],
    ['dim text', EXPECTED['--text-dim'], 'tinted surface', EXPECTED['--surface2']],
  ];

  for (const [name, foreground, onName, background] of cases) {
    it(`${name} on the ${onName} reaches AA`, () => {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(AA_BODY);
    });
  }

  it('keeps white legible on a solid brand button', () => {
    expect(contrast('#ffffff', EXPECTED['--red-brand'])).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('keeps the critical status distinguishable from the brand', () => {
    // With a red identity, a "critical" badge that reused the brand red would read as
    // ordinary furniture. They must be separable side by side, not merely both red.
    expect(contrast(EXPECTED['--red'], EXPECTED['--red-brand'])).toBeGreaterThan(1.5);
  });
});
