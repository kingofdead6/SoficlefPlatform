/**
 * Shared date-locale helper.
 *
 * en-GB rather than en-US on purpose: this is an Algerian company and its users read dates
 * as D/M/Y in both languages. en-US would silently reorder every date on the English side.
 */
export function localeOf(i18n) {
  return i18n?.language === 'en' ? 'en-GB' : 'fr-FR';
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
