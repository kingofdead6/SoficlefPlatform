import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import fr from './locales/fr.json';
import en from './locales/en.json';

const STORAGE_KEY = 'soficlef.lang';
export const SUPPORTED_LANGUAGES = ['fr', 'en'];

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
  },
  lng: resolveInitialLanguage(),
  fallbackLng: 'fr',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    // React escapes everything it renders; escaping again would double-encode entities.
    escapeValue: false,
  },
});

/** Keep <html lang> in step so screen readers and the browser announce the right language. */
function syncDocumentLanguage(language) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
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
 * dates as D/M/Y in both languages. en-US would silently reorder every date.
 */
export function localeTag(language = i18n.language) {
  return language === 'en' ? 'en-GB' : 'fr-FR';
}

export default i18n;
