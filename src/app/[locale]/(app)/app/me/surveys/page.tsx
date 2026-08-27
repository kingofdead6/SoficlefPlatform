import { redirect } from '@/i18n/navigation';
import { setRequestLocale } from 'next-intl/server';

/**
 * The recruit's satisfaction surveys.
 *
 * `/surveys` already does exactly this and splits its two audiences correctly — a
 * collaborator sees their own rounds and can answer them, everybody else sees aggregates
 * only. Duplicating it under `/app/me` would mean two pages to keep in step, and the
 * privacy rule (nobody but the author ever sees an individual answer) is the last thing
 * worth implementing twice.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect({ href: '/surveys', locale });
}
