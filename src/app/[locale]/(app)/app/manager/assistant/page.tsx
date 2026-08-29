import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { alertsFor, listRecruits } from '@/application/manager/team';
import { canOpen } from '@/application/navigation/build-navigation';
import { AssistantPanel } from '@/components/me/assistant-panel';
import { Card, CardBody, CardTitle, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The manager's assistant (`/app/manager/assistant`).
 *
 * The specification's Agent 4 answers "what's blocking X?", drafts feedback and looks up
 * procedures. Two of those three need a language model, deferred by ADR-003. The third —
 * what is blocking whom — needs no model at all: it is a question about rows, and the
 * answer is below, computed rather than generated.
 *
 * Drafting feedback is deliberately absent rather than faked. A generated appraisal that
 * a manager signs without writing is the failure mode worth avoiding, not the feature
 * worth mocking.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/manager/assistant');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const recruits = await listRecruits(user).catch(() => []);
  const alerts = alertsFor(recruits);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Ce que la plateforme peut répondre sans modèle de langage : des questions sur vos données, pas des textes rédigés à votre place.">
          Assistant
        </SectionTitle>
      </section>

      <section>
        <SectionTitle level={2} lead="La réponse à « qu’est-ce qui bloque ? », calculée depuis les parcours de votre périmètre.">
          Ce qui bloque en ce moment
        </SectionTitle>

        {alerts.length === 0 ? (
          <Card>
            <CardBody>
              Rien ne bloque : aucune étape en retard, aucune étape bloquée, aucun entretien
              imminent dans votre périmètre.
            </CardBody>
          </Card>
        ) : (
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
        )}
      </section>

      <section>
        <SectionTitle level={2} lead="« À qui m’adresser pour… » — répondu depuis votre organigramme et l’annuaire, avec la source de chaque réponse.">
          Trouver le bon interlocuteur
        </SectionTitle>
        <AssistantPanel />
      </section>

      <Card accent="red">
        <CardTitle>Rédaction de retours</CardTitle>
        <CardBody className="mt-1">
          Non proposée. Elle suppose un modèle de langage, écarté de cette phase — et un
          retour rédigé par la machine puis signé sans être écrit est précisément ce qu’une
          évaluation ne doit pas être. La trame d’entretien, elle, existe : elle rassemble
          les faits et les questions à poser, sans mettre de mots dans votre bouche.
        </CardBody>
        <Link href="/app/manager/evaluations" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
          Voir les évaluations à préparer →
        </Link>
      </Card>
    </div>
  );
}
