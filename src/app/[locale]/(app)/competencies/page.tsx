import { setRequestLocale } from 'next-intl/server';

import { ModulePlaceholder } from '@/components/shell/page-shell';

/**
 * The job–competency matrix and assessment history (Part 11).
 *
 * `Competency`, `JobCompetency` and `Assessment` exist in the schema but have no seed
 * data yet — the matrix has not been validated by the client (SCOPE.md §4). Showing an
 * empty table would look like a bug rather than a pending step, so this stays a
 * placeholder until Part 11 seeds real rows.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <ModulePlaceholder href="/competencies" />;
}
