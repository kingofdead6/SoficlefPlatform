import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Brand } from '@/components/shell/brand';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';

/**
 * The public shell — everything reachable without a session.
 *
 * This route group is deliberately a sibling of `(app)`, not a child: the `(app)` layout
 * resolves the session and refuses anonymous visitors, so a page that must stay public
 * cannot live under it. Nothing here reads `getCurrentUser()`, and nothing here queries a
 * table that carries personal data — the pages show the company's own public
 * presentation, the same material already on soficlef.com.
 *
 * Content is French because ADR-025 forbids machine-translating business text; the chrome
 * around it is translated, and the locale switcher still works, so an Arabic visitor gets
 * an Arabic interface with the French source text inside it.
 */

const NAV = [
  { href: '/', key: 'home' },
  { href: '/entreprise', key: 'company' },
  { href: '/strategie', key: 'strategy' },
  { href: '/carrieres', key: 'careers' },
] as const;

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('public');
  const app = await getTranslations('app');
  const common = await getTranslations('common');

  return (
    <div className="flex min-h-dvh flex-col bg-(--bg)">
      <a
        href="#public-content"
        className="text-gold-strong sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:bg-(--surface) focus:px-3 focus:py-2"
      >
        {common('skipToContent')}
      </a>

      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <Brand />

          <nav aria-label={t('nav.home')} className="flex flex-wrap items-center gap-4">
            {NAV.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="text-text-muted hover:text-text text-[13px]"
              >
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-3">
            <LocaleSwitcher current={locale as Locale} />
            <Link
              href="/login"
              className="rounded bg-(--gold) px-3 py-1.5 text-[12px] font-medium text-white"
            >
              {t('nav.signIn')}
            </Link>
          </div>
        </div>
      </header>

      <main
        id="public-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-5 py-10"
      >
        {children}
      </main>

      <footer className="border-t border-(--border) bg-(--surface)">
        <div className="text-text-dim mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[12px]">
          <span>
            © {new Date().getFullYear()} {app('company')}. {t('footer.rights')}
          </span>
          <span>{t('footer.internal')}</span>
        </div>
      </footer>
    </div>
  );
}
