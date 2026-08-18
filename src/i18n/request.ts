import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, isLocale } from './config';

/**
 * Per-request i18n configuration.
 *
 * The formats below carry `numberingSystem: 'latn'`, which is what makes Arabic render
 * Western Arabic digits (0–9) rather than Eastern ones (٠–٩). Document codes, phone
 * extensions and KPI figures are shared across the three locales, and a directory is
 * worth less if an extension reads differently per language (ADR-032, OQ-24).
 *
 * Note: `requestLocale` is marked deprecated by next-intl in favour of
 * `next/root-params`, whose types are generated during a build. Migrating now would make
 * `npm run typecheck` depend on a prior build, so this stays on the supported API until
 * those types are available without one.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    timeZone: 'Africa/Algiers',
    formats: {
      dateTime: {
        short: { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' },
        long: { day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' },
      },
      number: {
        integer: { maximumFractionDigits: 0, numberingSystem: 'latn' },
        percent: { style: 'percent', maximumFractionDigits: 1, numberingSystem: 'latn' },
      },
    },
    messages: (await import(`../../messages/${locale}.json`)).default,
    getMessageFallback({ key }) {
      // A missing key shows as the key rather than blanking the page. The parity check in
      // CI is what keeps the catalogues honest.
      return key;
    },
  };
});
