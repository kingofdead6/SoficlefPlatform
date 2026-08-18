import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LOCALE_DEFINITIONS, type Locale } from '@/i18n/config';
import { routing } from '@/i18n/routing';
import { fontVariables } from '@/lib/fonts';
import '@/styles/globals.css';

/**
 * The application's root layout. It lives inside `[locale]` because every page is
 * locale-prefixed (ADR-013), which is what lets `lang` and `dir` be decided once, here,
 * from the URL rather than from client-side state.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  return {
    title: { default: `${t('name')} · ${t('tagline')}`, template: `%s · ${t('name')}` },
    description: t('company'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // The [locale] segment also catches unknown paths, so an invalid value is a 404 rather
  // than a page rendered in a language that does not exist.
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale.
  setRequestLocale(locale);

  const definition = LOCALE_DEFINITIONS[locale as Locale];

  return (
    <html lang={locale} dir={definition.dir} className={fontVariables}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
