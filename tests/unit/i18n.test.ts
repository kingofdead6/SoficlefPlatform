import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  isLocale,
  localeDirection,
  resolveText,
} from '@/i18n/config';
import { formatDate, formatNumber, formatPercent, dayOffsetFrom } from '@/lib/format';

describe('locales', () => {
  it('supports French, Arabic and English, French by default', () => {
    expect(LOCALES).toEqual(['fr', 'ar', 'en']);
    expect(DEFAULT_LOCALE).toBe('fr');
  });

  it('marks Arabic as RTL and nothing else', () => {
    expect(localeDirection('ar')).toBe('rtl');
    expect(localeDirection('fr')).toBe('ltr');
    expect(localeDirection('en')).toBe('ltr');
  });

  it('rejects an unknown locale', () => {
    expect(isLocale('de')).toBe(false);
    expect(isLocale('ar')).toBe(true);
  });

  it('names each language in that language', () => {
    expect(LOCALE_DEFINITIONS.ar.nativeName).toBe('العربية');
    expect(LOCALE_DEFINITIONS.fr.nativeName).toBe('Français');
  });
});

describe('numerals and dates', () => {
  it('uses Western Arabic digits in the Arabic locale (ADR-032)', () => {
    // ar-DZ groups thousands with a dot, so the digits are checked rather than the
    // whole string: Eastern Arabic digits would render 2026 as ٢٠٢٦.
    expect(formatNumber(2026, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatNumber(2026, 'ar', { useGrouping: false })).toBe('2026');
  });

  it('keeps a business code identical in all three locales', () => {
    // A phone extension or a document code is shared across languages; a directory is
    // worth less if the extension reads differently per language (OQ-24).
    for (const locale of LOCALES) {
      expect(formatNumber(121, locale, { useGrouping: false })).toBe('121');
    }
  });

  it('formats a percentage without Eastern digits', () => {
    expect(formatPercent(60, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatPercent(60, 'fr')).toContain('60');
  });

  it('formats a date in every locale without Eastern digits', () => {
    const date = new Date('2026-06-07T09:00:00Z');
    for (const locale of LOCALES) {
      const formatted = formatDate(date, locale);
      expect(formatted).toMatch(/07/);
      expect(formatted).not.toMatch(/[٠-٩]/);
    }
  });

  it('counts onboarding days forward and backward from the start date', () => {
    const start = new Date('2026-06-07T08:00:00Z');
    expect(dayOffsetFrom(start, new Date('2026-06-07T18:00:00Z'))).toBe(0);
    expect(dayOffsetFrom(start, new Date('2026-06-10T08:00:00Z'))).toBe(3);
    // Before the start date the badge counts down rather than claiming J+1 (OQ-26).
    expect(dayOffsetFrom(start, new Date('2026-06-01T08:00:00Z'))).toBe(-6);
  });
});

describe('translation fallback (ADR-025)', () => {
  const field = { fr: 'Structure Fabrication', ar: null, en: null };

  it('returns the requested language when it exists', () => {
    expect(resolveText({ fr: 'Fabrication', ar: 'التصنيع', en: null }, 'ar')).toEqual({
      text: 'التصنيع',
      actualLocale: 'ar',
      isFallback: false,
    });
  });

  it('falls back to French and says that it did', () => {
    expect(resolveText(field, 'ar')).toEqual({
      text: 'Structure Fabrication',
      actualLocale: 'fr',
      isFallback: true,
    });
  });

  it('is not a fallback when French is what was asked for', () => {
    expect(resolveText(field, 'fr')?.isFallback).toBe(false);
  });

  it('returns null when there is nothing to show, rather than an empty string', () => {
    expect(resolveText({ fr: null, ar: null, en: null }, 'fr')).toBeNull();
  });
});

describe('message catalogues', () => {
  const messagesDir = new URL('../../messages/', import.meta.url);

  const flatten = (value: unknown, prefix = ''): string[] => {
    if (typeof value === 'string') return [prefix];
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key),
      );
    }
    return [];
  };

  const read = (locale: string) =>
    JSON.parse(readFileSync(new URL(`${locale}.json`, messagesDir), 'utf8')) as unknown;

  it('ships exactly one catalogue per supported locale', () => {
    const files = readdirSync(messagesDir)
      .filter((name) => name.endsWith('.json'))
      .sort();
    expect(files).toEqual(LOCALES.map((locale) => `${locale}.json`).sort());
  });

  it('mirrors the French key structure exactly', () => {
    const french = flatten(read('fr')).sort();
    for (const locale of LOCALES.filter((code) => code !== 'fr')) {
      expect(flatten(read(locale)).sort(), `${locale} differs from fr`).toEqual(french);
    }
  });

  it('passes the parity check the CI gate runs', () => {
    // The check is a script so it can fail a build; running it here means a broken
    // catalogue is caught by `npm run test:unit` too.
    // Spawn the current Node binary with tsx's CLI resolved from node_modules rather
    // than shelling out to `npx`: on Windows `npx` is a `.cmd` shim, which execFileSync
    // refuses to run without a shell (ENOENT, then EINVAL on newer Node). The check
    // therefore never actually ran on a Windows machine.
    const tsxCli = createRequire(import.meta.url).resolve('tsx/cli');
    expect(() =>
      execFileSync(process.execPath, [tsxCli, 'scripts/check-messages.ts'], { stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('translates the navigation into Arabic rather than leaving French in place', () => {
    const arabic = read('ar') as { nav: { items: Record<string, string> } };
    for (const [key, value] of Object.entries(arabic.nav.items)) {
      expect(value, `nav.items.${key} is not translated`).toMatch(/[؀-ۿ]/);
    }
  });
});
