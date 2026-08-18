import { getTranslations } from 'next-intl/server';

/** Per-segment loading boundary: the chrome stays, the content area shows progress. */
export default async function Loading() {
  const t = await getTranslations('common');

  return (
    <div className="animate-pulse" role="status" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <div className="mb-5 h-7 w-64 rounded bg-(--surface2)" />
      <div className="h-40 rounded-(--radius) border border-(--border) bg-(--surface)" />
    </div>
  );
}
