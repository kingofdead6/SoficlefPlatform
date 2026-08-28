import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadHrDashboard } from '@/application/hr/dashboard';
import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Alerts and reminders (`/app/hr/alerts`).
 *
 * The rules below are the ones the platform actually applies today, stated as rules rather
 * than as an editable form that would imply they can be changed. They are computed at read
 * time from dates and statuses — nothing is scheduled, and nothing is sent, because there
 * is no messaging channel configured.
 */

const RULES = [
  {
    id: 'unassigned',
    titleFr: 'Compte sans affectation',
    triggerFr: 'Dès qu’un compte créé reste sans poste.',
    audienceFr: 'RH',
    escalationFr: 'Visible en permanence en tête du tableau de bord et de la file d’affectation.',
  },
  {
    id: 'overdue',
    titleFr: 'Étape d’intégration en retard',
    triggerFr: 'Quand une étape dépasse son échéance sans être terminée.',
    audienceFr: 'RH et responsable du collaborateur',
    escalationFr: 'Le parcours concerné est signalé en rouge sur la fiche de la personne.',
  },
  {
    id: 'survey',
    titleFr: 'Enquête ouverte sans réponse',
    triggerFr: 'Quand une enquête a dépassé son échéance et n’a pas été renseignée.',
    audienceFr: 'Collaborateur concerné',
    escalationFr: 'Signalée sur son espace ; les RH en voient le taux agrégé.',
  },
  {
    id: 'files',
    titleFr: 'Pièce administrative manquante',
    triggerFr: 'Quand une pièce demandée n’est ni transmise ni validée.',
    audienceFr: 'Collaborateur concerné, suivi RH',
    escalationFr: 'Listée sur son espace et comptée sur le tableau de bord RH.',
  },
];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/alerts');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const hr = await loadHrDashboard(user);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Ce que la plateforme surveille, et ce qu’elle déclenche. Les règles sont appliquées au moment de la lecture : rien n’est planifié, rien n’est envoyé.">
          Alertes & relances
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={hr.alerts.length} label="Alertes actives" />
          <KpiTile value={hr.pendingAssignments} label="Comptes sans poste" />
          <KpiTile value={hr.onboardingsLate} label="Parcours en retard" />
        </div>
      </section>

      {hr.alerts.length > 0 ? (
        <section>
          <SectionTitle level={2}>En ce moment</SectionTitle>
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
        </section>
      ) : null}

      <section>
        <SectionTitle level={2}>Règles appliquées</SectionTitle>
        <ul className="space-y-3">
          {RULES.map((rule) => (
            <li key={rule.id}>
              <Card>
                <CardTitle>{rule.titleFr}</CardTitle>
                <CardBody className="mt-1">{rule.triggerFr}</CardBody>
                <dl className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
                  <div>
                    <dt className="text-text-dim inline">Destinataire : </dt>
                    <dd className="text-text-muted inline">{rule.audienceFr}</dd>
                  </div>
                  <div>
                    <dt className="text-text-dim inline">Escalade : </dt>
                    <dd className="text-text-muted inline">{rule.escalationFr}</dd>
                  </div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Card accent="red">
        <CardTitle>Relances par e-mail</CardTitle>
        <CardBody className="mt-1">
          Aucune relance n’est envoyée : aucun serveur de messagerie n’est configuré. Les
          alertes sont donc visibles dans la plateforme et nulle part ailleurs — ce qui est
          honnête, mais suppose qu’on l’ouvre. Raccorder une messagerie transformerait ces
          mêmes règles en envois, sans les réécrire.
        </CardBody>
      </Card>

      <Card>
        <CardTitle>Modifier les règles</CardTitle>
        <CardBody className="mt-1">
          Les seuils ci-dessus sont ceux du cahier des charges. Les rendre modifiables
          suppose de décider qui peut les changer et ce qu’il advient des alertes déjà
          déclenchées — une question de gouvernance avant d’être un écran.
        </CardBody>
      </Card>
    </div>
  );
}
