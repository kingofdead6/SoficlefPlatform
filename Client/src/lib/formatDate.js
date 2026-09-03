/**
 * Shared date-locale helper.
 *
 * en-GB rather than en-US on purpose: this is an Algerian company and its users read dates
 * as D/M/Y in every language. en-US would silently reorder every date on the English side.
 * ar-DZ (Algeria) for the same reason on the Arabic side: it keeps D/M/Y order and Western
 * (Latin) digits, unlike ar-EG or ar-SA which default to Eastern Arabic numerals — this app
 * never shows those elsewhere (scores, counts, phone extensions stay Latin), so the dates
 * must not be the one place that switches numeral systems.
 */
export function localeOf(i18n) {
  if (i18n?.language === 'en') return 'en-GB';
  if (i18n?.language === 'ar') return 'ar-DZ';
  return 'fr-FR';
}

/** Convenience: format a date value with the caller's active language. */
export function formatDate(value, i18n, options) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(localeOf(i18n), options);
}

/** Convenience: format a date + time with the caller's active language. */
export function formatDateTime(value, i18n, options) {
  if (!value) return '';
  return new Date(value).toLocaleString(localeOf(i18n), options);
}
