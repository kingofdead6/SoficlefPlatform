'use client';

import { useTranslations } from 'next-intl';

import { NAV_ITEMS } from '@/domain/navigation/navigation';
import { usePathname } from '@/i18n/navigation';

/**
 * The current page's name, in the display face.
 *
 * Derived from the path rather than passed down from each page: a layout cannot read the
 * pathname in the App Router, and threading a title through every page is one more thing
 * to forget when Part 6 adds content.
 */
export function TopBarTitle({ fallback }: { fallback: string }) {
  const t = useTranslations('nav.items');
  const pathname = usePathname();

  const item = NAV_ITEMS.find(
    (candidate) => pathname === candidate.href || pathname.startsWith(`${candidate.href}/`),
  );

  return (
    <h1 className="font-display text-text truncate text-[17px] font-medium">
      {item ? t(item.id) : fallback}
    </h1>
  );
}
