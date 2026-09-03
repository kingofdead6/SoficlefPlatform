import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

const STORAGE_KEY = 'soficlef.lang';
export const SUPPORTED_LANGUAGES = ['fr', 'en', 'ar'];
export const RTL_LANGUAGES = ['ar'];

/**
 * Resolve the starting language: an explicit stored choice wins, then the browser's
 * preference, then French. Written inline rather than pulling in a detector package —
 * the whole rule is three lines and the dependency would earn nothing.
 */
function resolveInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch {
    // Private mode / blocked storage: fall through to the browser preference.
  }

  const navigatorLanguage = typeof navigator !== 'undefined' ? navigator.language : '';
  const prefix = (navigatorLanguage || '').split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.includes(prefix) ? prefix : 'fr';
}

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: resolveInitialLanguage(),
  fallbackLng: 'fr',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    // React escapes everything it renders; escaping again would double-encode entities.
    escapeValue: false,
  },
});

/**
 * Keep <html lang> and <html dir> in step so screen readers, the browser, and every
 * logical-property Tailwind class (ps-/pe-/start-/end-/ms-/me-) get the right direction.
 * Those utilities read `dir` from the document, not from i18n, so this is the one place
 * that has to run on every language change for RTL to take effect anywhere.
 */
function syncDocumentLanguage(language) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  }
}

syncDocumentLanguage(i18n.language);

i18n.on('languageChanged', (language) => {
  syncDocumentLanguage(language);
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Persisting is a convenience; a blocked store must not break the switch.
  }
});

/**
 * The BCP-47 tag to hand `toLocaleDateString` / `toLocaleString`.
 *
 * en-GB rather than en-US on purpose: this is an Algerian company and its users read
 * dates as D/M/Y in French and English alike. en-US would silently reorder every date.
 * Arabic dates use the same D/M/Y order via ar-DZ (Algeria), with Western digits — ar-DZ
 * defaults to Latin numerals, unlike ar-EG or ar-SA, which matches what the rest of the
 * app already shows (scores, counts, phone extensions are never Eastern Arabic numerals).
 */
export function localeTag(language = i18n.language) {
  if (language === 'en') return 'en-GB';
  if (language === 'ar') return 'ar-DZ';
  return 'fr-FR';
}

export default i18n;
