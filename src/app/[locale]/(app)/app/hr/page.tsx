import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadHrDashboard } from '@/application/hr/dashboard';
import { canOpen } from '@/application/navigation/build-navigation';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { Card, CardBody, CardTitle, KpiTile, ProgressBar, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The HR dashboard (`/app/hr`), CDC-2026 Module 10.
 *
 * The alert feed is the working surface: everything else on this page is context for it.
 * An empty feed is the goal state and says so, rather than rendering an apologetic blank.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const hr = await loadHrDashboard(user);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="L’état des intégrations en cours, et ce qui demande une action de votre part.">
          Tableau de bord RH
        </SectionTitle>

        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StaggerItem>
            <KpiTile value={hr.hiresThisMonth} label="Recrutements ce mois" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={hr.onboardingsInProgress} label="Intégrations en cours" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={hr.onboardingsCompleted} label="Intégrations terminées" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              value={hr.onboardingsLate}
              label="En retard"
              hint={hr.onboardingsLate === 0 ? 'Aucun retard' : 'À relancer'}
            />
          </StaggerItem>
        </Stagger>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Avancement global</CardTitle>
          <CardBody className="mt-1">
            {hr.completionPercent === null
              ? 'Aucune intégration en cours.'
              : `${hr.completionPercent}% des étapes sont faites, toutes intégrations confondues.`}
          </CardBody>
          {hr.completionPercent !== null ? (
            <ProgressBar
              className="mt-3"
              value={hr.completionPercent}
              label="Avancement des parcours en cours"
            />
          ) : null}
        </Card>

        <Card>
          <CardTitle>Satisfaction</CardTitle>
          <CardBody className="mt-1">
            {hr.satisfactionPercent === null
              ? 'Pas encore de réponse aux enquêtes.'
              : `Score consolidé de ${hr.satisfactionPercent}%. Plancher de recette : 85%.`}
          </CardBody>
          {hr.satisfactionPercent !== null ? (
            <ProgressBar
              className="mt-3"
              value={hr.satisfactionPercent}
              label="Score de satisfaction"
            />
          ) : null}
          <Link href="/app/hr/surveys/results" className="text-red-strong mt-3 inline-block text-[12px] font-medium">
            Voir le détail par indicateur →
          </Link>
        </Card>
      </section>

      <section>
        <SectionTitle level={2} lead="Ce qui bloque, ce qui traîne, et ce qui attend une décision.">
          Alertes
        </SectionTitle>

        {hr.alerts.length === 0 ? (
          <Card>
            <CardBody>
              Rien à signaler : aucun compte en attente, aucune étape en retard, aucun
              dossier incomplet.
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {hr.alerts.map((alert) => (
              <li key={alert.id}>
                <Card accent={alert.severity === 'red' ? 'red' : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{alert.titleFr}</CardTitle>
                      <CardBody className="mt-1">{alert.detailFr}</CardBody>
                    </div>
                    <StatusBadge
                      label={alert.severity === 'red' ? 'À traiter' : 'À suivre'}
                      tone={alert.severity === 'red' ? 'red' : 'blue'}
                    />
                  </div>
                  <Link href={alert.href} className="text-red-strong mt-3 inline-block text-[12px] font-medium">
                    Ouvrir →
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
