import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 p-8 text-center">
      <p className="text-text-dim font-mono text-xs tracking-widest uppercase">404</p>
      <h1 className="font-display text-text text-2xl">{t('notFound')}</h1>
      <p className="text-text-muted text-[13px]">{t('notFoundLead')}</p>
      <p>
        <Link href="/welcome" className="text-red-brand underline underline-offset-4">
          {t('backToHome')}
        </Link>
      </p>
    </main>
  );
}
