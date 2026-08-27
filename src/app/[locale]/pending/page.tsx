import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Brand } from '@/components/shell/brand';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import { SignOutButton } from '@/components/shell/sign-out-button';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/navigation';

/**
 * Where an account with no assignment lands.
 *
 * The provisioning chain has two steps and two owners: SI creates the account, HR gives it
 * a post. Between the two the person can sign in and there is genuinely nothing for them
 * to do — so this page says so plainly and names who to ask, rather than showing an empty
 * dashboard that looks broken.
 *
 * No sidebar, no documents, no data: the whole point is that this account has no
 * perimeter yet. It deliberately sits outside the `(app)` route group, whose layout would
 * otherwise render the shell around it.
 */
export default async function PendingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });

  // Somebody who *has* been placed has no business here; send them to the platform.
  if (user && user.lifecycleState !== 'PENDING_ASSIGNMENT') {
    redirect({ href: '/dashboard', locale });
  }

  const t = await getTranslations('pending');

  /*
   * The HR contact, from the directory rather than a hardcoded name: the person to chase
   * changes, and a stale name on this page is worse than no name at all.
   */
  const contact = await prisma.contact
    .findFirst({
      where: { roleFr: { contains: 'Emploi', mode: 'insensitive' } },
      select: { nameFr: true, roleFr: true, extension: true },
    })
    .catch(() => null);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-(--bg) p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <Brand />
          <LocaleSwitcher current={locale as Locale} />
        </div>

        <div className="rounded-(--radius) border border-(--border) bg-(--surface) p-6 shadow-(--shadow)">
          <h1 className="font-display text-text text-xl">{t('title')}</h1>
          <p className="text-text-muted mt-2 text-[13px]">{t('lead')}</p>

          <p className="text-text mt-4 text-[13px]">
            {t('greeting', { name: user?.displayName ?? '' })}
          </p>

          {contact ? (
            <div className="border-s-2 border-(--red-brand) bg-(--red-dim) mt-5 rounded-(--radius) p-4">
              <p className="text-text-muted text-[11px] uppercase tracking-wide">
                {t('contactLabel')}
              </p>
              <p className="text-text mt-1 text-[13px] font-medium">{contact.nameFr}</p>
              <p className="text-text-muted text-[12px]">{contact.roleFr}</p>
              {contact.extension ? (
                <p className="text-text mt-1 font-mono text-[12px]">
                  {t('extension')} {contact.extension}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6">
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
