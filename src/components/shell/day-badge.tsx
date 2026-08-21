import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/config';
import { dayOffsetFrom, formatDate } from '@/lib/format';

/**
 * The onboarding day badge.
 *
 * The prototype hardcodes "J+1 · 07.06.2026". Here it is computed from the signed-in
 * user's start date, and it counts *down* before that date rather than claiming a journey
 * has begun — M. Djaoudi's start date is 07.06.2026, so anyone opening the platform
 * earlier would otherwise be told they are on day one (OQ-26).
 */
export async function DayBadge({ startDate, locale }: { startDate: Date | null; locale: Locale }) {
  const t = await getTranslations('shell');
  if (!startDate) return null;

  const offset = dayOffsetFrom(startDate);
  const label =
    offset > 0
      ? t('dayBadge', { days: offset })
      : offset < 0
        ? t('dayBadgeBefore', { days: Math.abs(offset) })
        : t('dayBadgeStart');

  return (
    <span className="text-red-strong rounded border border-[rgba(139,105,20,0.25)] bg-(--red-dim) px-2.5 py-1 font-mono text-[10.5px] tabular-nums">
      {label} · {formatDate(startDate, locale)}
    </span>
  );
}
