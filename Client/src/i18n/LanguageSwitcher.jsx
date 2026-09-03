import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'AR' },
];

/**
 * Compact FR/EN/AR segmented control.
 *
 * Three real buttons rather than a dropdown: the current language is announced by
 * aria-pressed on each, so a screen-reader user hears which one is active instead of
 * having to infer it from a label that changes meaning.
 *
 * The control's own layout direction is pinned to ltr regardless of the active language:
 * "FR / EN / AR" is a fixed, memorised order for a switcher, and letting it flip under
 * Arabic would make it the one control in the app that changes shape every time it's used.
 *
 * `tone="light"` is for the dark/!translucent public bar; the default suits the app shell.
 */
export function LanguageSwitcher({ tone = 'default', className = '' }) {
  const { t, i18n } = useTranslation();
  const active = LANGUAGES.some((language) => language.code === i18n.language)
    ? i18n.language
    : 'fr';

  return (
    <div
      role="group"
      dir="ltr"
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
