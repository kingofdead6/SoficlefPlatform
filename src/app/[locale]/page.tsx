import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

/**
 * Placeholder landing page. Part 5 replaces it with the application shell and the
 * signed-in user's home route.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('app');

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-8">
      <p className="text-text-dim font-mono text-xs tracking-widest uppercase">{t('company')}</p>
      <h1 className="text-text text-3xl">
        {t('name')} · {t('tagline')}
      </h1>
      <p className="text-text-muted">
        Fondations en place : Next.js, PostgreSQL, Prisma, authentification et périmètres,
        internationalisation FR / AR / EN.
      </p>
      <Link className="text-gold underline underline-offset-4" href="/dev/tokens">
        Design system
      </Link>
    </main>
  );
}
