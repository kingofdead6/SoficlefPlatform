'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * The navigation list.
 *
 * A client component only because the active entry depends on the current path; the
 * *contents* were decided on the server (ADR-031), so nothing here can widen what a user
 * sees.
 */
export interface NavGroupView {
  id: string;
  items: { id: string; href: string; badge?: string | null }[];
}

export function SidebarNav({
  groups,
  onNavigate,
  className,
}: {
  groups: NavGroupView[];
  /** Lets the mobile drawer close itself when a link is followed. */
  onNavigate?: () => void;
  className?: string;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('mainNavigation')} className={cn('flex-1 overflow-y-auto p-2.5', className)}>
      {groups.map((group) => (
        <div key={group.id} className="mb-2">
          <h2 className="text-text-dim px-2.5 pt-2.5 pb-1 text-[8.5px] tracking-[0.16em] uppercase">
            {t(`groups.${group.id}`)}
          </h2>
          <ul>
            {group.items.map((item) => {
              // `startsWith` so a nested detail route keeps its parent highlighted.
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'mb-px flex items-center gap-2.5 rounded-md border border-transparent px-3 py-2 text-[12px] transition-colors',
                      isActive
                        ? 'text-gold-strong border-[rgba(139,105,20,0.2)] bg-(--gold-dim) font-medium'
                        : 'text-text-muted hover:text-text hover:bg-(--surface2)',
                    )}
                  >
                    <span className="truncate">{t(`items.${item.id}`)}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          'ms-auto rounded px-1.5 py-0.5 font-mono text-[9px] tabular-nums',
                          isActive
                            ? 'text-gold-strong bg-[rgba(139,105,20,0.15)]'
                            : 'text-text-dim bg-(--surface2)',
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
