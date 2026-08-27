import { redirect } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';

/**
 * The recruit's training.
 *
 * `/training` already carries the catalogue, the module player, the quiz and the
 * certificates, scoped to the caller's own attempts. Pointing here rather than copying it
 * keeps one implementation of the pass/fail rules.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: '/training', locale });
}
