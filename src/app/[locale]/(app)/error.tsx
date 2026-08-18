'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

/**
 * Per-segment error boundary. The chrome survives, so a failure on one page does not
 * throw the user out of the application.
 */
export default function SegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const common = useTranslations('common');

  useEffect(() => {
    // The digest is what ties this screen to the server-side log entry.
    console.error('segment error', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="rounded-(--radius) border border-(--red) bg-(--surface) p-8 text-center">
      <h2 className="font-display text-text text-lg">{t('serverError')}</h2>
      <p className="text-text-muted mx-auto mt-2 max-w-prose text-[13px]">{t('serverErrorLead')}</p>
      {error.digest ? (
        <p className="text-text-dim mt-2 font-mono text-[11px]">{error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="text-gold mt-5 rounded-md border border-(--gold) bg-(--gold-dim) px-3 py-1.5 text-[13px] hover:bg-(--gold-accent)/20"
      >
        {common('retry')}
      </button>
    </div>
  );
}
