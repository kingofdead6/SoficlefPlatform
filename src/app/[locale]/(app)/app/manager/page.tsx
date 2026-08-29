import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { alertsFor, listRecruits } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { ProgressRing } from '@/components/me/progress-ring';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The manager's landing page (`/app/manager`).
 *
 * One card per recruit, because a manager thinks in people rather than in tasks. The alert
 * panel is what makes the page worth opening: a card says how somebody is doing, an alert
 * says what to do about it today.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const recruits = await listRecruits(user).catch(() => []);
  const alerts = alertsFor(recruits);

  const evaluationsDue = recruits.reduce(
    (sum, recruit) => sum + recruit.evaluationsDue.length,
    0,
  );

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Les intégrations dont vous êtes responsable, et ce qui demande votre intervention.">
          Encadrement
        </SectionTitle>

        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StaggerItem>
            <KpiTile value={recruits.length} label="Intégrations suivies" href="/app/manager/recruits" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              value={recruits.filter((recruit) => recruit.overdue > 0).length}
              label="En retard"
              href="/app/manager/recruits?status=late"
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              value={recruits.filter((recruit) => recruit.blocked > 0).length}
              label="Bloquées"
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={evaluationsDue} label="Évaluations à faire" href="/app/manager/evaluations" />
          </StaggerItem>
        </Stagger>
      </section>

      {alerts.length > 0 ? (
        <section>
          <SectionTitle level={2} lead="Traité de haut en bas : ce qui bloque d’abord, ce qui traîne ensuite, ce qui approche en dernier.">
            À traiter
          </SectionTitle>

          <ul className="space-y-3">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Card compact accent={alert.severity === 'red' ? 'red' : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{alert.titleFr}</CardTitle>
                      <CardBody className="mt-1">{alert.detailFr}</CardBody>
                    </div>
                    <StatusBadge
                      label={
                        alert.kind === 'blocked'
                          ? 'Bloquée'
                          : alert.kind === 'overdue'
                            ? 'En retard'
                            : 'Entretien'
                      }
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
        <SectionTitle level={2}>Mes recrues</SectionTitle>

        {recruits.length === 0 ? (
          <Card>
            <CardBody>
              Aucune intégration en cours dans votre périmètre. Les parcours apparaissent ici
              dès que les RH affectent quelqu’un à un poste de votre structure.
            </CardBody>
          </Card>
        ) : (
          <Stagger as="ul" className="grid gap-4 sm:grid-cols-2">
            {recruits.map((recruit) => (
              <StaggerItem as="li" key={recruit.instanceId}>
                <Card accent={recruit.overdue > 0 || recruit.blocked > 0 ? 'red' : undefined}>
                  <div className="flex items-start gap-4">
                    <ProgressRing percent={recruit.percent} size={72} />

                    <div className="min-w-0 flex-1">
                      <CardTitle>{recruit.displayName}</CardTitle>
                      <CardBody className="mt-0.5">
                        {recruit.positionFr ?? 'Poste non renseigné'}
                      </CardBody>
                      <p className="text-text-dim mt-1 font-mono text-[11px]">
                        Jour {recruit.dayNumber} · démarré le{' '}
                        {formatDate(recruit.startDate, locale as Locale)}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {recruit.blocked > 0 ? (
                          <StatusBadge label={`${recruit.blocked} bloquée(s)`} tone="red" />
                        ) : null}
                        {recruit.overdue > 0 ? (
                          <StatusBadge label={`${recruit.overdue} en retard`} tone="red" />
                        ) : null}
                        {recruit.overdue === 0 && recruit.blocked === 0 ? (
                          <StatusBadge label="À jour" tone="green" />
                        ) : null}
                        {recruit.evaluationsDue.map((evaluation) => (
                          <StatusBadge key={evaluation.id} label={evaluation.milestone} tone="blue" />
                        ))}
                      </div>

                      <Link
                        href={`/app/manager/recruits/${recruit.userId}`}
                        className="text-red-strong mt-3 inline-block text-[12px] font-medium"
                      >
                        Ouvrir le dossier →
                      </Link>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
