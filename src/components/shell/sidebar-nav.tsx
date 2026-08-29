'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';

import { NavIcon } from './nav-icon';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { DURATION, EASE_OUT, prefersReducedMotion } from '@/lib/motion';

/**
 * The navigation list.
 *
 * A client component only because the active entry depends on the current path; the
 * *contents* were decided on the server (ADR-031), so nothing here can widen what a user
 * sees.
 *
 * The active entry's tint is a shared layout element rather than a class on each link, so
 * Framer Motion slides it between entries on navigation instead of having it disappear
 * here and reappear there. This is the one place shared-layout animation earns its keep:
 * the movement traces the path between where the reader was and where they now are.
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
  const reduced = prefersReducedMotion();

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
                      'group relative mb-px flex items-center gap-2.5 rounded-md border border-transparent px-2.5 py-[7px] text-[12px] transition-colors',
                      isActive
                        ? 'text-red-strong font-medium'
                        : 'text-text-muted hover:text-text hover:bg-(--surface2)',
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        // One id for the whole nav, so the tint is a single element that
                        // moves rather than one that is destroyed and recreated.
                        layoutId="nav-active"
                        aria-hidden
                        className="absolute inset-0 z-0 rounded-md border border-(--red-veil) bg-(--red-dim)"
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { duration: DURATION.base, ease: EASE_OUT }
                        }
                      />
                    ) : null}
                    <NavIcon
                      id={item.id}
                      className={cn(
                        'relative z-10 size-4 shrink-0 transition-opacity',
                        isActive ? 'opacity-100' : 'opacity-55 group-hover:opacity-90',
                      )}
                    />
                    <span className="relative z-10 truncate">{t(`items.${item.id}`)}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          'relative z-10 ms-auto rounded px-1.5 py-0.5 font-mono text-[9px] tabular-nums',
                          isActive
                            ? 'text-red-strong bg-(--red-veil)'
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
