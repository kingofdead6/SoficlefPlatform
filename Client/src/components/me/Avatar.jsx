import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/cn.js';

/**
 * A person's photo, with initials as the fallback.
 *
 * Shared by the New Hire portal's organigram sheet, team page and position page (route guide
 * §2.1 asks for a photo on the org-chart card and the team cards). Initials rather than a
 * silhouette placeholder: most rows have no `avatarUrl`, a missing photo is the normal state
 * rather than an error, and initials still identify the person at a glance.
 *
 * `avatarUrl` comes from Cloudinary via POST /users/me/avatar. A broken or expired URL falls
 * back to the initials at runtime rather than leaving a broken-image icon in the chart.
 */
const SIZES = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-14 w-14 text-sm',
  lg: 'h-20 w-20 text-lg',
};

export function initialsOf(name) {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function Avatar({ name, url, size = 'md', className }) {
  const { t } = useTranslation();
  const dimensions = SIZES[size] ?? SIZES.md;
  const initials = initialsOf(name);

  if (url) {
    return (
      <img
        src={url}
        alt={name ? t('common.avatarAlt', { name }) : ''}
        className={cn('shrink-0 rounded-full object-cover', dimensions, className)}
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <span
      aria-hidden={!name}
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        dimensions,
        name ? 'bg-red-brand/15 text-red-deep' : 'bg-surface-2 text-text-dim',
        className,
      )}
    >
      {initials || '—'}
    </span>
  );
}
