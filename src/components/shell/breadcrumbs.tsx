import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';

/**
 * Breadcrumbs, rendered only where nesting warrants them: a top-level page in a
 * fifteen-item sidebar does not need a trail back to itself.
 */
export async function Breadcrumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  const t = await getTranslations('shell');
  if (trail.length < 2) return null;

  return (
    <nav aria-label={t('breadcrumb')} className="mb-4">
      <ol className="text-text-dim flex flex-wrap items-center gap-1.5 text-[11.5px]">
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {crumb.href && !isLast ? (
                <Link href={crumb.href} className="hover:text-text">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="text-text-muted">
                  {crumb.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden className="rtl:rotate-180">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
