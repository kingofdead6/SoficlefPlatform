import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
];

/**
 * Compact FR/EN segmented control.
 *
 * Two real buttons rather than a single toggle: the current language is announced by
 * aria-pressed on each, so a screen-reader user hears which one is active instead of
 * having to infer it from a label that changes meaning.
 *
 * `tone="light"` is for the dark/!translucent public bar; the default suits the app shell.
 */
export function LanguageSwitcher({ tone = 'default', className = '' }) {
  const { t, i18n } = useTranslation();
  const active = i18n.language?.startsWith('en') ? 'en' : 'fr';

  return (
    <div
      role="group"
      aria-label={t('common.language.switcherLabel')}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5 ${
        tone === 'light' ? 'border-white/25 bg-white/10' : 'border-border bg-surface-2'
      } ${className}`}
    >
      {LANGUAGES.map((language) => {
        const isActive = active === language.code;
        return (
          <button
            key={language.code}
            type="button"
            onClick={() => i18n.changeLanguage(language.code)}
            aria-pressed={isActive}
            aria-label={t('common.language.switchTo', { language: t(`common.language.${language.code}`) })}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight transition-colors ${
              isActive
                ? 'bg-red-brand text-white'
                : tone === 'light'
                  ? 'text-white/70 hover:text-white'
                  : 'text-text-dim hover:text-text'
            }`}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageSwitcher;
