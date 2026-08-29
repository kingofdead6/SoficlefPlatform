import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listAuditTrail } from '@/application/admin/directory';
import { canOpen } from '@/application/navigation/build-navigation';
import {
  Card,
  CardBody,
  CardTitle,
  DataTable,
  KpiTile,
  SectionTitle,
  type Column,
} from '@/components/ui';
import { AUDIT_ACTIONS } from '@/domain/audit/actions';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The audit trail (`/admin/audit`).
 *
 * Append-only: nothing in the application can edit or delete a row, which is what makes it
 * worth reading. The filters narrow what is displayed and never what was recorded.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; action?: string; from?: string; to?: string }>;
}) {
  const { locale } = await params;
  const filters = await searchParams;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/audit');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const rows = await listAuditTrail(user, 300, {
    search: filters.q,
    action: filters.action,
    from: filters.from,
    to: filters.to,
  }).catch(() => []);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'when',
      header: 'Horodatage',
      mono: true,
      render: (row) => formatDate(row.createdAt, locale as Locale),
    },
    { key: 'actor', header: 'Auteur', render: (row) => row.actorLabel },
    { key: 'action', header: 'Action', mono: true, render: (row) => row.action },
    {
      key: 'entity',
      header: 'Objet',
      render: (row) => (
        <>
          <span className="text-text">{row.entityType}</span>
          {row.entityId ? (
            <span className="text-text-dim block font-mono text-[10px]">{row.entityId}</span>
          ) : null}
        </>
      ),
    },
    { key: 'ip', header: 'Adresse', align: 'end', mono: true, render: (row) => row.ip ?? '—' },
  ];

  const failures = rows.filter(
    (row) => row.action === 'auth.login_failed' || row.action === 'access.denied',
  ).length;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Chaque changement est enregistré avec son auteur, son horodatage et son adresse, dans la transaction qui l’a produit. Rien ici ne peut être modifié ni supprimé depuis l’application.">
          Journal d’audit
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={rows.length} label="Événements affichés" hint="300 au maximum" />
          <KpiTile value={failures} label="Refus et échecs" />
          <KpiTile value={AUDIT_ACTIONS.length} label="Types d’action" />
        </div>
      </section>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="q" className="text-text block text-[12px] font-medium">
            Auteur ou objet
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filters.q ?? ''}
            className="mt-1 w-full rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          />
        </div>

        <div>
          <label htmlFor="action" className="text-text block text-[12px] font-medium">
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={filters.action ?? ''}
            className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          >
            <option value="">Toutes</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="from" className="text-text block text-[12px] font-medium">
            Du
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from ?? ''}
            className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          />
        </div>

        <div>
          <label htmlFor="to" className="text-text block text-[12px] font-medium">
            Au
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={filters.to ?? ''}
            className="mt-1 rounded border border-(--border) bg-(--surface) px-3 py-2 text-[13px]"
          />
        </div>

        <button
          type="submit"
          className="rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white"
        >
          Filtrer
        </button>
        <Link href="/admin/audit" className="text-text-muted pb-2 text-[12px]">
          Réinitialiser
        </Link>
      </form>

      {rows.length === 0 ? (
        <Card>
          <CardBody>Aucun événement ne correspond à ces critères.</CardBody>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          emptyLabel="Aucun événement."
          caption="Journal d’audit"
        />
      )}

      <Card>
        <CardTitle>Export</CardTitle>
        <CardBody className="mt-1">
          Non proposé depuis cet écran. Un export du journal est lui-même un événement à
          journaliser — qui a extrait quoi, et quand — et il vaut mieux ne pas l’ouvrir que
          l’ouvrir sans cette trace. L’export des remarques, qui suit cette règle, sert de
          modèle.
        </CardBody>
      </Card>
    </div>
  );
}
