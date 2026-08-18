import { getTranslations } from 'next-intl/server';

import { resolveText, type Locale, type TranslatableField } from '@/i18n/config';

/**
 * Renders a translatable business field, and says so when the text shown is not in the
 * requested language.
 *
 * Extracted business content is French and stays French until the client supplies
 * reviewed translations (ADR-025). Showing the French text with a visible
 * "traduction en attente" marker is honest; a machine translation of an HR document,
 * a job description or an HSE rule would be plausible and wrong, which is worse.
 */
export async function TranslatableText({
  field,
  locale,
  className,
}: {
  field: TranslatableField;
  locale: Locale;
  className?: string;
}) {
  const t = await getTranslations('common');
  const resolved = resolveText(field, locale);

  if (!resolved) return <span className={className}>{t('notAvailable')}</span>;

  if (!resolved.isFallback) {
    return <span className={className}>{resolved.text}</span>;
  }

  return (
    <span className={className}>
      {/* lang tells a screen reader to switch voice; dir keeps a French phrase readable
          inside an Arabic paragraph. */}
      <span lang={resolved.actualLocale} dir="ltr">
        {resolved.text}
      </span>{' '}
      <span
        className="text-text-muted ms-1 inline-flex items-center gap-1 rounded border border-(--border) bg-(--surface2) px-1.5 py-0.5 align-middle text-[10px]"
        title={t('translationPendingHint')}
      >
        <span aria-hidden>⌛</span>
        {t('translationPending')}
      </span>
    </span>
  );
}
