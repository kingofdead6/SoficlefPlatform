import { setRequestLocale } from 'next-intl/server';

import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { redirect } from '@/i18n/navigation';

/**
 * The locale root is a router, not a page: a signed-in user lands on their welcome
 * screen, anyone else on the sign-in form. Keeping this decision on the server means the
 * browser never renders a screen it will immediately replace.
 */
export default async function LocaleRoot({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  redirect({ href: user ? '/welcome' : '/login', locale });
}
