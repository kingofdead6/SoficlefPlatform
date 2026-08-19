import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import {
  listAuditTrail,
  listRoles,
  listUnitsForScope,
  listUsers,
} from '@/application/admin/directory';
import { canOpen } from '@/application/navigation/build-navigation';
import { AssignRoleDialog } from '@/components/admin/assign-role-dialog';
import { UserStatusControl } from '@/components/admin/user-status-control';
import {
  Card,
  CardBody,
  DataTable,
  KpiTile,
  SectionTitle,
  StatusBadge,
  Tabs,
  type Column,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Administration (CDC v0.1 §11): accounts, roles and the audit trail.
 *
 * This is the technical administrator's screen. The business reference frame —
 * structures, jobs, competencies — is administered from its own module by the business
 * administrator, which is why none of it appears here.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [users, roles, audit, units] = await Promise.all([
    listUsers(user).catch(() => []),
    listRoles(user).catch(() => []),
    listAuditTrail(user).catch(() => []),
    listUnitsForScope(user).catch(() => []),
  ]);

  const activeCount = users.filter((row) => row.status === 'ACTIVE').length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile value={users.length} label="Comptes" />
        <KpiTile value={activeCount} label="Comptes actifs" />
        <KpiTile value={roles.length} label="Rôles" />
        <KpiTile value={audit.length} label="Événements récents" />
      </div>

      <Tabs
        label="Sections d'administration"
        items={[
          {
            value: 'users',
            label: 'Utilisateurs',
            content: (
              <UsersTab rows={users} units={units} actorId={user.id} locale={locale as Locale} />
            ),
          },
          { value: 'roles', label: 'Rôles & permissions', content: <RolesTab rows={roles} /> },
          {
            value: 'audit',
            label: "Journal d'audit",
            content: <AuditTab rows={audit} locale={locale as Locale} />,
          },
        ]}
      />
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

function RolesTab({ rows }: { rows: Awaited<ReturnType<typeof listRoles>> }) {
  return (
    <div className="space-y-3 pt-4">
      {rows.map((role) => (
        <Card key={role.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-text font-mono text-[13px] font-semibold">{role.code}</span>
            <StatusBadge label={`${role.userCount} compte(s)`} tone="neutral" />
          </div>
          <CardBody className="mt-1">
            {role.nameFr}
            {role.description ? ` — ${role.description}` : ''}
          </CardBody>
          <ul className="mt-3 flex flex-wrap gap-1">
            {role.permissions.map((code) => (
              <li
                key={code}
                className="text-text-muted rounded border border-(--border) bg-(--surface2) px-1.5 py-0.5 font-mono text-[10px]"
              >
                {code}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function AuditTab({
  rows,
  locale,
}: {
  rows: Awaited<ReturnType<typeof listAuditTrail>>;
  locale: Locale;
}) {
  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: 'when',
      header: 'Quand',
      mono: true,
      render: (row) =>
        formatDate(row.createdAt, locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    { key: 'actor', header: 'Acteur', render: (row) => row.actorLabel },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className="font-mono text-[11px]">{row.action}</span>,
    },
    { key: 'entity', header: 'Objet', render: (row) => row.entityType },
    { key: 'ip', header: 'Adresse', mono: true, render: (row) => row.ip ?? '—' },
  ];

  return (
    <div className="space-y-4 pt-4">
      <SectionTitle
        level={3}
        lead="Les 100 événements les plus récents. Le journal est en ajout seul : rien ne peut y être modifié ni supprimé depuis l'application."
      >
        Journal d&apos;audit
      </SectionTitle>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        emptyLabel="Aucun événement journalisé."
        caption="Journal d'audit des opérations sensibles"
      />
    </div>
  );
}
