import { setRequestLocale } from 'next-intl/server';

import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { redirect } from '@/i18n/navigation';

/**
 * The locale root is a router, not a page: a signed-in user lands on their dashboard,
 * anyone else on the sign-in form. Keeping this decision on the server means the browser
 * never renders a screen it will immediately replace.
 *
 * The dashboard is the landing page rather than /welcome because /welcome is one
 * person's onboarding hero: it reads as a form letter to everybody else.
 */
export default async function LocaleRoot({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  redirect({ href: user ? '/dashboard' : '/login', locale });
}
