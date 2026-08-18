'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { LOCALES, LOCALE_DEFINITIONS, type Locale } from '@/i18n/config';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Switches language while staying on the same page.
 *
 * The current path is re-pushed under another locale, so state carried in the URL — the
 * page, its query, a filter — survives the switch (Part 4 acceptance).
 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const t = useTranslations('shell');
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t('localeSwitcher')}>
      {LOCALES.map((locale) => {
        const isCurrent = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            disabled={isPending}
            aria-current={isCurrent ? 'true' : undefined}
            onClick={() =>
              startTransition(() => {
                router.replace(
                  // @ts-expect-error — pathname and params come from the current route,
                  // which typed routes cannot narrow at this call site.
                  { pathname, params },
                  { locale },
                );
              })
            }
            className={cn(
              'rounded px-2 py-1 font-mono text-[11px] uppercase transition-colors',
              isCurrent
                ? 'text-gold-strong bg-(--gold-dim) font-medium'
                : 'text-text-dim hover:text-text hover:bg-(--surface2)',
            )}
          >
            <span className="sr-only">{LOCALE_DEFINITIONS[locale].nativeName}</span>
            <span aria-hidden>{locale}</span>
          </button>
        );
      })}
    </div>
  );
}
