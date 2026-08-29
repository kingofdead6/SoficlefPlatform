import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listUnitsForScope, listUsers } from '@/application/admin/directory';
import { canOpen } from '@/application/navigation/build-navigation';
import { AssignRoleDialog } from '@/components/admin/assign-role-dialog';
import { UserStatusControl } from '@/components/admin/user-status-control';
import {
  Card,
  CardBody,
  CardTitle,
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
import { connectorStatuses } from '@/domain/admin/connectors';

/**
 * Accounts (`/admin/users`).
 *
 * Creating an account is where the provisioning chain starts and where the administrator's
 * part of it ends: giving that account a post is HR's act, on their own screen. The card
 * below links there rather than duplicating the form.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/users');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [users, units] = await Promise.all([
    listUsers(user).catch(() => []),
    listUnitsForScope(user).catch(() => []),
  ]);

  const entra = connectorStatuses(process.env).find((status) => status.definition.id === 'entra');
  const entraLive = entra?.mode === 'production';

  const active = users.filter((row) => row.status === 'ACTIVE').length;

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Les comptes de la plateforme. Créer un compte est le premier pas de la chaîne d’habilitation ; lui donner un poste est le second, et il appartient aux RH.">
          Comptes
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={users.length} label="Comptes" />
          <KpiTile value={active} label="Actifs" />
          <KpiTile value={users.length - active} label="Suspendus" />
          <KpiTile value={units.length} label="Structures" />
        </div>
      </section>

      <UsersTab rows={users} units={units} actorId={user.id} locale={locale as Locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>File d’habilitation</CardTitle>
          <CardBody className="mt-1">
            Les demandes des RH en attente de création, et les comptes créés que personne
            n’a encore affectés — les deux côtés du même relais.
          </CardBody>
          <Link
            href="/admin/users/provisioning"
            className="text-red-strong mt-2 inline-block text-[12px] font-medium"
          >
            Ouvrir la file →
          </Link>
        </Card>

        <Card accent={entraLive ? undefined : 'red'}>
          <CardTitle>Création en masse et Entra ID</CardTitle>
          <CardBody className="mt-1">
            {entraLive
              ? 'La synchronisation Entra ID est configurée : les identités peuvent être rattachées.'
              : 'Import en masse et synchronisation Entra ID indisponibles : aucun annuaire n’est raccordé. Les comptes se créent un par un, ce qui convient à un site pilote et pas à une reprise d’effectif.'}
          </CardBody>
          <Link
            href="/admin/integrations"
            className="text-red-strong mt-2 inline-block text-[12px] font-medium"
          >
            Voir les intégrations →
          </Link>
        </Card>
      </div>
    </div>
  );
}

function UsersTab({
  rows,
  units,
  actorId,
  locale,
}: {
  rows: Awaited<ReturnType<typeof listUsers>>;
  units: Awaited<ReturnType<typeof listUnitsForScope>>;
  actorId: string;
  locale: Locale;
}) {
  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      render: (row) => (
        <div>
          <div className="text-text font-medium">{row.displayName}</div>
          <div className="text-text-dim font-mono text-[11px]">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Rôles et périmètre',
      render: (row) =>
        row.roles.length === 0 ? (
          <span className="text-text-dim">Aucun rôle</span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {row.roles.map((role) => (
              <StatusBadge
                key={`${role.code}-${role.unitCode ?? 'global'}`}
                label={role.unitCode ? `${role.code} · ${role.unitCode}` : role.code}
                tone={role.unitCode ? 'blue' : 'neutral'}
              />
            ))}
          </span>
        ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => (
        <UserStatusControl
          userId={row.id}
          status={row.status}
          // An administrator cannot suspend their own account and lock themselves out.
          disabled={row.id === actorId}
        />
      ),
    },
    {
      key: 'lastLogin',
      header: 'Dernière connexion',
      mono: true,
      render: (row) => (row.lastLoginAt ? formatDate(row.lastLoginAt, locale) : '—'),
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'end',
      render: (row) => (
        <AssignRoleDialog
          userId={row.id}
          userName={row.displayName}
          units={units}
          // Self-assignment is refused server-side and audited; the button is hidden too
          // so the refusal is not the first thing an administrator discovers.
          disabled={row.id === actorId}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 pt-4">
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        emptyLabel="Aucun compte."
        caption="Comptes utilisateurs et rôles"
      />
      <Card>
        <CardBody>
          Un administrateur ne peut pas s&apos;attribuer un rôle à lui-même ni suspendre son propre
          compte : la tentative est refusée et journalisée.
        </CardBody>
      </Card>
    </div>
  );
}
