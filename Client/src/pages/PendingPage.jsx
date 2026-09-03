import { useTranslation } from 'react-i18next';

export default function PendingPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-center">
      <div>
        <h1 className="mb-2 font-display text-2xl text-red-deep">{t('auth.pending.title')}</h1>
        <p className="text-text-dim">{t('auth.pending.body')}</p>
      </div>
    </div>
  );
}
