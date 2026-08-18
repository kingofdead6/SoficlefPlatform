/**
 * Locale configuration (ADR-013, CDC v0.1 §12).
 *
 * French is the platform's design and content language. Arabic adds RTL. English is
 * there for the international industrial vocabulary (Kaizen, Lean, SMED, TRS/OEE, ISO).
 */

export const LOCALES = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export interface LocaleDefinition {
  code: Locale;
  /** How the language names itself — a switcher must not rename someone's language. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
  /**
   * The BCP-47 tag used for dates, numbers and collation.
   *
   * `ar-DZ-u-nu-latn` asks for Algerian Arabic conventions with Western Arabic digits
   * (0–9) rather than Eastern ones (٠–٩): document codes, phone extensions and KPI
   * figures are shared across the three locales, and a directory is worth less if the
   * extension reads differently per language (ADR-032, OQ-24).
   */
  intlLocale: string;
}

export const LOCALE_DEFINITIONS: Record<Locale, LocaleDefinition> = {
  fr: { code: 'fr', nativeName: 'Français', dir: 'ltr', intlLocale: 'fr-DZ' },
  ar: { code: 'ar', nativeName: 'العربية', dir: 'rtl', intlLocale: 'ar-DZ-u-nu-latn' },
  en: { code: 'en', nativeName: 'English', dir: 'ltr', intlLocale: 'en-GB' },
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function localeDirection(locale: Locale): 'ltr' | 'rtl' {
  return LOCALE_DEFINITIONS[locale].dir;
}

/**
 * Picks the best available text for a translatable field, and says whether it fell back.
 *
 * Business content extracted from the prototype is French and stays French until the
 * client supplies reviewed translations (ADR-025). Rather than hiding that, the UI shows
 * the French text with a "traduction en attente" affordance — a visibly missing
 * translation is a task; a plausible machine translation of an HR document is a
 * liability.
 */
export interface TranslatableField {
  fr: string | null;
  ar?: string | null;
  en?: string | null;
}

export interface ResolvedText {
  text: string;
  /** The locale the text is actually written in. */
  actualLocale: Locale;
  /** True when the requested locale had no reviewed translation. */
  isFallback: boolean;
}

export function resolveText(field: TranslatableField, locale: Locale): ResolvedText | null {
  const requested = field[locale];
  if (requested) return { text: requested, actualLocale: locale, isFallback: false };

  if (field.fr) return { text: field.fr, actualLocale: 'fr', isFallback: locale !== 'fr' };

  // Nothing in French either: English is the last resort before giving up.
  if (field.en) return { text: field.en, actualLocale: 'en', isFallback: locale !== 'en' };

  return null;
}
