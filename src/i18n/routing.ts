import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, LOCALES } from './config';

/**
 * Locale-prefixed routes: `/fr/...`, `/ar/...`, `/en/...` (ADR-013).
 *
 * `always` rather than `as-needed`: a URL then states its language, so a link pasted into
 * a message opens in the language the sender was reading, and the French default never
 * hides behind an unprefixed path.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
