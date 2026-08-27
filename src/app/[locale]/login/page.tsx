import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Brand } from '@/components/shell/brand';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/navigation';

import { LoginForm } from './login-form';

/** Sign-in. Someone already signed in is sent on rather than shown a second form. */
export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const signedIn = await getCurrentUser();
  if (signedIn) {
    // An unplaced account has nowhere to land but `/pending`; sending it to the dashboard
    // would only bounce it back through the app layout.
    redirect({
      href: signedIn.lifecycleState === 'PENDING_ASSIGNMENT' ? '/pending' : '/dashboard',
      locale,
    });
  }

  const t = await getTranslations('auth');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-(--bg) p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <Brand />
          <LocaleSwitcher current={locale as Locale} />
        </div>

        <div className="rounded-(--radius) border border-(--border) bg-(--surface) p-6 shadow-(--shadow)">
          <h1 className="font-display text-text text-xl">{t('signInTitle')}</h1>
          <p className="text-text-muted mt-1 mb-5 text-[13px]">{t('signInLead')}</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
