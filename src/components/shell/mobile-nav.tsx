'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Drawer } from '@/components/ui';

import { SidebarNav, type NavGroupView } from './sidebar-nav';

/**
 * Below tablet width the sidebar becomes a drawer. Same navigation data, same active
 * state — only the container changes.
 */
export function MobileNav({ groups, brand }: { groups: NavGroupView[]; brand: React.ReactNode }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      title={t('mainNavigation')}
      closeLabel={t('closeMenu')}
      trigger={
        <button
          type="button"
          aria-label={t('openMenu')}
          className="text-text-muted hover:text-text rounded-md border border-(--border) px-2.5 py-1.5 hover:bg-(--surface2) lg:hidden"
        >
          <span aria-hidden>☰</span>
        </button>
      }
    >
      <div className="border-b border-(--border) p-4">{brand}</div>
      <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
    </Drawer>
  );
}
