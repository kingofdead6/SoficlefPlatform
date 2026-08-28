import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { directoryFacets, listEmployees } from '@/application/hr/directory';
import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, DataTable, KpiTile, SectionTitle, StatusBadge, type Column } from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The employee directory (`/app/hr/employees`).
 *
 * Filters are URL parameters rather than client state: a filtered view is then a link
 * somebody can send to a colleague, and the back button behaves. Every filter narrows
 * *within* the caller's perimeter — the query is scoped before any of them apply.
 */

const LIFECYCLE: Record<string, { label: string; tone: StatusTone }> = {
  PENDING_ASSIGNMENT: { label: 'Sans poste', tone: 'red' },
  ASSIGNED: { label: 'En poste', tone: 'green' },
  ARCHIVED: { label: 'Archivé', tone: 'neutral' },
};

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; unit?: string; manager?: string; state?: string }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/employees');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [rows, facets] = await Promise.all([
    listEmployees(user, {
      search: filters.q,
      unitCode: filters.unit,
      managerId: filters.manager,
      lifecycleState: filters.state,
    }).catch(() => []),
    directoryFacets(user).catch(() => ({ units: [], managers: [] })),
  ]);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'person',
      header: 'Collaborateur',
      render: (row) => (
        <>
          <Link href={`/app/hr/employees/${row.id}`} className="text-red-strong font-medium">
            {row.displayName}
          </Link>
          <span className="text-text-dim block text-[11px]">{row.email}</span>
        </>
      ),
    },
    {
      key: 'position',
      header: 'Poste',
      render: (row) => row.positionFr ?? row.positionTitleFr ?? '—',
    },
    { key: 'unit', header: 'Structure', render: (row) => row.unitCode ?? '—' },
    { key: 'manager', header: 'Responsable', render: (row) => row.managerName ?? '—' },
    {
      key: 'hired',
      header: 'Embauche',
      align: 'end',
      mono: true,
      render: (row) => (row.hireDate ? formatDate(row.hireDate, locale as Locale) : '—'),
    },
    {
      key: 'state',
      header: 'État',
      render: (row) => {
        const state = LIFECYCLE[row.lifecycleState] ?? {
          label: row.lifecycleState,
          tone: 'neutral' as StatusTone,
        };
        return (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={state.label} tone={state.tone} />
            {row.onboardingPercent !== null ? (
              <span className="text-text-dim font-mono text-[11px]">
                {row.onboardingPercent}%
              </span>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="L’annuaire de votre périmètre. Les filtres restreignent ce que vous voyez déjà — ils n’élargissent jamais.">
          Collaborateurs
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={rows.length} label="Résultats" />
          <KpiTile
            value={rows.filter((row) => row.lifecycleState === 'PENDING_ASSIGNMENT').length}
            label="Sans poste"
          />
          <KpiTile
            value={rows.filter((row) => row.onboardingPercent !== null).length}
            label="En intégration"
          />
          <KpiTile value={facets.units.length} label="Structures" />
        </div>
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="q" className="text-text block text-[12px] font-medium">
            Rechercher
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Nom, e-mail ou intitulé de poste"
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          />
        </div>

        <div>
          <label htmlFor="unit" className="text-text block text-[12px] font-medium">
            Structure
          </label>
          <select
            id="unit"
            name="unit"
            defaultValue={filters.unit ?? ''}
            className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="">Toutes</option>
            {facets.units.map((unit) => (
              <option key={unit.code} value={unit.code}>
                {unit.code} — {unit.nameFr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="manager" className="text-text block text-[12px] font-medium">
            Responsable
          </label>
          <select
            id="manager"
            name="manager"
            defaultValue={filters.manager ?? ''}
            className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="">Tous</option>
            {facets.managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="state" className="text-text block text-[12px] font-medium">
            État
          </label>
          <select
            id="state"
            name="state"
            defaultValue={filters.state ?? ''}
            className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="">Tous</option>
            <option value="PENDING_ASSIGNMENT">Sans poste</option>
            <option value="ASSIGNED">En poste</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white"
        >
          Filtrer
        </button>
        <Link href="/app/hr/employees" className="text-text-muted pb-2 text-[12px]">
          Réinitialiser
        </Link>
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardBody>Aucun collaborateur ne correspond à ces critères.</CardBody>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          emptyLabel="Aucun collaborateur."
          caption="Annuaire des collaborateurs"
        />
      )}
    </div>
  );
}
