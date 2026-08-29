import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listRecruits } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import {
  Card,
  CardBody,
  DataTable,
  KpiTile,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Every recruit in the manager's perimeter (`/app/manager/recruits`).
 *
 * Archived journeys are included on request rather than by default: a finished integration
 * is history a manager sometimes needs, and never something they need first.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ archived?: string; status?: string }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/recruits');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const includeArchived = filters.archived === '1';
  const all = await listRecruits(user, { includeArchived }).catch(() => []);

  const rows =
    filters.status === 'late'
      ? all.filter((recruit) => recruit.overdue > 0 || recruit.blocked > 0)
      : filters.status === 'ontrack'
        ? all.filter((recruit) => recruit.overdue === 0 && recruit.blocked === 0)
        : all;

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'person',
      header: 'Collaborateur',
      render: (row) => (
        <>
          <Link href={`/app/manager/recruits/${row.userId}`} className="text-red-strong font-medium">
            {row.displayName}
          </Link>
          <span className="text-text-dim block text-[11px]">
            {row.positionFr ?? row.email}
          </span>
        </>
      ),
    },
    {
      key: 'start',
      header: 'Démarré',
      align: 'end',
      mono: true,
      render: (row) => formatDate(row.startDate, locale as Locale),
    },
    { key: 'day', header: 'Jour', align: 'end', mono: true, render: (row) => `J+${row.dayNumber}` },
    {
      key: 'progress',
      header: 'Avancement',
      align: 'end',
      mono: true,
      render: (row) => `${row.percent}% (${row.done}/${row.total})`,
    },
    {
      key: 'state',
      header: 'État',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.completed ? <StatusBadge label="Terminé" tone="neutral" /> : null}
          {row.blocked > 0 ? <StatusBadge label={`${row.blocked} bloquée(s)`} tone="red" /> : null}
          {row.overdue > 0 ? <StatusBadge label={`${row.overdue} en retard`} tone="red" /> : null}
          {!row.completed && row.overdue === 0 && row.blocked === 0 ? (
            <StatusBadge label="À jour" tone="green" />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Les intégrations de votre périmètre. Vous ne voyez pas celles des autres structures — la restriction est appliquée par la requête, pas par l’affichage.">
          Mes recrues
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={rows.length} label="Résultats" />
          <KpiTile
            value={all.filter((recruit) => !recruit.completed).length}
            label="En cours"
          />
          <KpiTile
            value={all.filter((recruit) => recruit.overdue > 0 || recruit.blocked > 0).length}
            label="Attention requise"
          />
          <KpiTile
            value={all.filter((recruit) => recruit.completed).length}
            label="Terminées"
            hint={includeArchived ? undefined : 'Masquées'}
          />
        </div>
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="status" className="text-text block text-[12px] font-medium">
            État
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ''}
            className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="">Tous</option>
            <option value="late">Attention requise</option>
            <option value="ontrack">À jour</option>
          </select>
        </div>

        <label className="text-text flex items-center gap-2 pb-2 text-[13px]">
          <input type="checkbox" name="archived" value="1" defaultChecked={includeArchived} />
          Inclure les parcours terminés
        </label>

        <button
          type="submit"
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white"
        >
          Filtrer
        </button>
        <Link href="/app/manager/recruits" className="text-text-muted pb-2 text-[12px]">
          Réinitialiser
        </Link>
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardBody>Aucune intégration ne correspond à ces critères.</CardBody>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.instanceId}
          emptyLabel="Aucune intégration."
          caption="Intégrations suivies"
        />
      )}
    </div>
  );
}
