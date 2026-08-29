import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import type { StatusTone } from '@/components/ui';
import { connectorStatuses, type ConnectorMode } from '@/domain/admin/connectors';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * External systems (`/admin/integrations`).
 *
 * Each connector is read from the environment rather than from a database row, which is
 * why the toggle here is a *report* and not a switch: flipping a connector at runtime
 * would let somebody point production at a mock, or a mock at production, from a browser.
 * The name of the variable to set is shown instead — a deployment change, reviewed like
 * one.
 */

const MODE: Record<ConnectorMode, { label: string; tone: StatusTone; meaningFr: string }> = {
  production: {
    label: 'Production',
    tone: 'green',
    meaningFr: 'Raccordé au système réel.',
  },
  mock: {
    label: 'Simulé',
    tone: 'blue',
    meaningFr: 'Répond avec des données de démonstration, volontairement.',
  },
  unconfigured: {
    label: 'Non configuré',
    tone: 'red',
    meaningFr: 'Personne ne l’a raccordé : ce n’est pas un choix, c’est un manque.',
  },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/integrations');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const connectors = connectorStatuses(process.env);
  const live = connectors.filter((connector) => connector.mode === 'production').length;
  const mocked = connectors.filter((connector) => connector.mode === 'mock').length;
  const missing = connectors.filter((connector) => connector.mode === 'unconfigured').length;

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Ce à quoi la plateforme est raccordée, et ce qui ne fonctionne pas tant qu’elle ne l’est pas.">
          Intégrations
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={live} label="En production" />
          <KpiTile value={mocked} label="Simulés" />
          <KpiTile
            value={missing}
            label="Non configurés"
            hint={missing > 0 ? 'Fonctions dégradées' : undefined}
          />
        </div>
      </section>

      <ul className="space-y-3">
        {connectors.map((connector) => (
          <li key={connector.definition.id}>
            <Card accent={connector.mode === 'unconfigured' ? 'red' : undefined}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>{connector.definition.labelFr}</CardTitle>
                  <CardBody className="mt-1">{MODE[connector.mode].meaningFr}</CardBody>
                  {connector.mode === 'unconfigured' ? (
                    <CardBody className="mt-1">{connector.definition.consequenceFr}</CardBody>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge
                    label={MODE[connector.mode].label}
                    tone={MODE[connector.mode].tone}
                  />
                  <code className="text-text-dim font-mono text-[10px]">
                    {connector.definition.envVar}
                  </code>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Basculer un connecteur</CardTitle>
          <CardBody className="mt-1">
            Le mode se règle par variable d’environnement, pas depuis cet écran : un
            interrupteur ici permettrait de pointer la production vers une simulation — ou
            l’inverse — depuis un navigateur. Mettre la variable à <code>mock</code> active
            le mode simulé ; toute autre valeur vaut production.
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Tester la connexion</CardTitle>
          <CardBody className="mt-1">
            Aucun test proposé : aucun de ces connecteurs n’a d’adresse à interroger pour
            l’instant, et un bouton qui répond toujours « connexion réussie » ne teste que
            lui-même. Le test viendra avec le premier connecteur réellement raccordé.
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
