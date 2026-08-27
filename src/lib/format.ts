import { LOCALE_DEFINITIONS, type Locale } from '@/i18n/config';

/**
 * Locale-aware formatting for the paths that format directly rather than through
 * next-intl's `useFormatter`.
 *
 * Every formatter is built from the locale's full BCP-47 tag, which is what carries the
 * Western Arabic numbering system into the Arabic locale (ADR-032, OQ-24). Formatters are
 * cached because `Intl` constructors are comparatively expensive and these run per row.
 */

const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function tag(locale: Locale): string {
  return LOCALE_DEFINITIONS[locale].intlLocale;
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: Intl.NumberFormatOptions = {},
): string {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(tag(locale), { numberingSystem: 'latn', ...options });
    numberFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

export function formatPercent(value: number, locale: Locale): string {
  return formatNumber(value / 100, locale, { style: 'percent', maximumFractionDigits: 1 });
}

export function formatDate(
  value: Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(tag(locale), {
      numberingSystem: 'latn',
      timeZone: 'Africa/Algiers',
      ...options,
    });
    dateFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

/**
 * A date with its time, for anything that records *when* something happened.
 *
 * An audit entry or a status change needs the hour: two changes on the same day are
 * otherwise indistinguishable, which defeats the point of keeping a history.
 */
export function formatDateTime(value: Date, locale: Locale): string {
  return formatDate(value, locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Whole days between a start date and today, in the site's time zone.
 *
 * Used for the onboarding day badge: positive after the start date, negative before it —
 * the badge counts down rather than pretending the journey has begun (OQ-26).
 */
export function dayOffsetFrom(startDate: Date, now: Date = new Date()): number {
  const dayInMs = 24 * 60 * 60 * 1000;
  const startOfDay = (date: Date): number => {
    const local = new Date(date.toLocaleString('en-US', { timeZone: 'Africa/Algiers' }));
    local.setHours(0, 0, 0, 0);
    return local.getTime();
  };
  return Math.round((startOfDay(now) - startOfDay(startDate)) / dayInMs);
}
