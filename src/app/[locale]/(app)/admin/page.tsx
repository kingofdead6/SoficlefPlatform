import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { listActiveSessions, loadAdminConsole } from '@/application/admin/console';
import { canOpen } from '@/application/navigation/build-navigation';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
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
import type { StatusTone } from '@/components/ui';
import type { ConnectorMode } from '@/domain/admin/connectors';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The administrator's console (`/admin`).
 *
 * Measured, not declared: sessions are counted rows, the failure counts come from the
 * audit trail, and connector state is read from the environment. A health page that
 * reports its own configuration back to itself stays green while the platform is down.
 */

const MODE: Record<ConnectorMode, { label: string; tone: StatusTone }> = {
  production: { label: 'Production', tone: 'green' },
  mock: { label: 'Simulé', tone: 'blue' },
  unconfigured: { label: 'Non configuré', tone: 'red' },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [health, sessions] = await Promise.all([
    loadAdminConsole(user),
    listActiveSessions(user).catch(() => []),
  ]);

  const columns: Column<(typeof sessions)[number]>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      render: (row) => (
        <>
          <span className="text-text font-medium">{row.user.displayName}</span>
          <span className="text-text-dim block text-[11px]">{row.user.email}</span>
        </>
      ),
    },
    { key: 'ip', header: 'Adresse', mono: true, render: (row) => row.ip ?? '—' },
    {
      key: 'seen',
      header: 'Dernière activité',
      align: 'end',
      mono: true,
      render: (row) => formatDate(row.lastSeenAt, locale as Locale),
    },
    {
      key: 'expires',
      header: 'Expire',
      align: 'end',
      mono: true,
      render: (row) => formatDate(row.expiresAt, locale as Locale),
    },
  ];

  const degraded = health.connectors.filter(
    (connector) => connector.mode === 'unconfigured',
  ).length;

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="L’état réel de la plateforme : sessions ouvertes, refus enregistrés, connecteurs raccordés ou non.">
          Console
        </SectionTitle>

        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StaggerItem>
            <KpiTile
              value={health.activeSessions}
              label="Sessions ouvertes"
              hint={`${health.distinctUsersOnline} utilisateur(s)`}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              value={health.failedLogins24h}
              label="Échecs de connexion"
              hint="24 dernières heures"
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              value={health.accessDenied24h}
              label="Accès refusés"
              hint="24 dernières heures"
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              value={degraded}
              label="Connecteurs manquants"
              hint={degraded === 0 ? 'Tout est raccordé' : 'Fonctions dégradées'}
              href="/admin/integrations"
            />
          </StaggerItem>
        </Stagger>
      </section>

      <section>
        <SectionTitle level={2} lead="Ce que la plateforme sait faire dépend de ce qui est raccordé. Un connecteur absent n’est pas une panne : c’est une fonction qui n’existe pas encore.">
          Connecteurs
        </SectionTitle>

        <ul className="space-y-2">
          {health.connectors.map((connector) => (
            <li key={connector.definition.id}>
              <Card accent={connector.mode === 'unconfigured' ? 'red' : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{connector.definition.labelFr}</CardTitle>
                    {connector.mode === 'unconfigured' ? (
                      <CardBody className="mt-1">{connector.definition.consequenceFr}</CardBody>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge
                      label={MODE[connector.mode].label}
                      tone={MODE[connector.mode].tone}
                    />
                    <span className="text-text-dim font-mono text-[10px]">
                      {connector.definition.envVar}
                    </span>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <Link
          href="/admin/integrations"
          className="text-red-strong mt-3 inline-block text-[12px] font-medium"
        >
          Détail des intégrations →
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Comptes</CardTitle>
          <CardBody className="mt-1">
            {health.accountsActive} actif(s), {health.accountsSuspended} suspendu(s),{' '}
            {health.accountsPending} sans poste.
          </CardBody>
          {health.openAccountRequests > 0 ? (
            <Link
              href="/admin/users/provisioning"
              className="text-red-strong mt-2 inline-block text-[12px] font-medium"
            >
              {health.openAccountRequests} demande(s) en attente →
            </Link>
          ) : null}
        </Card>

        <Card>
          <CardTitle>Données</CardTitle>
          <CardBody className="mt-1">
            {health.storedDocuments} document(s) référencé(s), {health.storedFiles} pièce(s)
            administrative(s), {health.auditRows} entrée(s) d’audit.
          </CardBody>
          <p className="text-text-dim mt-2 text-[11px]">
            Volumes de lignes : la taille disque dépend de l’hébergeur et n’est pas
            mesurable depuis l’application.
          </p>
        </Card>

        <Card>
          <CardTitle>Activité</CardTitle>
          <CardBody className="mt-1">
            {health.lastActivityAt
              ? `Dernier événement enregistré le ${formatDate(health.lastActivityAt, locale as Locale)}.`
              : 'Aucun événement enregistré.'}
          </CardBody>
          <CardBody className="mt-1">
            {health.sessionsLast24h} session(s) ouverte(s) sur 24 heures.
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionTitle level={2} lead="Une session révoquée prend effet à la requête suivante : elle est relue à chaque requête plutôt que gardée en mémoire.">
          Sessions ouvertes
        </SectionTitle>

        {sessions.length === 0 ? (
          <Card>
            <CardBody>Aucune session ouverte.</CardBody>
          </Card>
        ) : (
          <DataTable
            columns={columns}
            rows={sessions}
            getRowKey={(row) => row.id}
            emptyLabel="Aucune session."
            caption="Sessions ouvertes"
          />
        )}
      </section>
    </div>
  );
}
