import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * Survey configuration (`/app/hr/surveys`).
 *
 * The four milestones are fixed by CDC-2026 §9 — J+7, J+30, J+60, J+90 — and shown here
 * with their real emission and response counts rather than as settings nobody has set. A
 * milestone that emits nothing is the failure worth catching, and a count says that
 * immediately.
 */

const MILESTONES = [
  { dayOffset: 7, labelFr: 'Première semaine', purposeFr: 'L’accueil a-t-il eu lieu comme prévu.' },
  { dayOffset: 30, labelFr: 'Premier mois', purposeFr: 'Le poste est-il compris, l’accompagnement suffisant.' },
  { dayOffset: 60, labelFr: 'Deuxième mois', purposeFr: 'L’autonomie s’installe-t-elle.' },
  { dayOffset: 90, labelFr: 'Fin de période d’essai', purposeFr: 'Bilan avant confirmation.' },
];

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/surveys');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const rounds = await prisma.surveyRound
    .findMany({
      select: {
        dayOffset: true,
        dueDate: true,
        _count: { select: { responses: true } },
      },
    })
    .catch(() => []);

  const now = new Date();

  const byMilestone = MILESTONES.map((milestone) => {
    const mine = rounds.filter((round) => round.dayOffset === milestone.dayOffset);
    const open = mine.filter((round) => round.dueDate <= now);
    const answered = mine.filter((round) => round._count.responses > 0);

    return {
      ...milestone,
      issued: mine.length,
      open: open.length,
      answered: answered.length,
      responseRate: open.length === 0 ? null : Math.round((answered.length / open.length) * 100),
    };
  });

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Quatre enquêtes jalonnent chaque intégration. Les échéances se calculent depuis la date de prise de poste — elles ne se règlent pas ici, elles en découlent.">
          Enquêtes
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={rounds.length} label="Enquêtes émises" />
          <KpiTile
            value={rounds.filter((round) => round._count.responses > 0).length}
            label="Répondues"
          />
          <KpiTile
            value={rounds.filter((round) => round.dueDate <= now && round._count.responses === 0).length}
            label="Ouvertes sans réponse"
          />
        </div>
      </section>

      <section>
        <SectionTitle level={2}>Jalons</SectionTitle>
        <ul className="space-y-3">
          {byMilestone.map((milestone) => (
            <li key={milestone.dayOffset}>
              <Card accent={milestone.responseRate !== null && milestone.responseRate < 50 ? 'red' : undefined}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>
                      J+{milestone.dayOffset} · {milestone.labelFr}
                    </CardTitle>
                    <CardBody className="mt-1">{milestone.purposeFr}</CardBody>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge
                      label={
                        milestone.responseRate === null
                          ? 'Pas encore ouverte'
                          : `${milestone.responseRate}% de réponses`
                      }
                      tone={
                        milestone.responseRate === null
                          ? 'neutral'
                          : milestone.responseRate >= 50
                            ? 'green'
                            : 'red'
                      }
                    />
                    <span className="text-text-dim font-mono text-[11px]">
                      {milestone.answered}/{milestone.open} ouvertes · {milestone.issued} émises
                    </span>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Card>
        <CardTitle>Anonymat</CardTitle>
        <CardBody className="mt-1">
          Les réponses individuelles ne sont consultables par personne, y compris les RH :
          seuls les agrégats le sont. C’est cette garantie qui rend une réponse honnête
          possible, et c’est pourquoi elle est appliquée dans la requête plutôt que par une
          convention d’écran.
        </CardBody>
        <Link href="/app/hr/surveys/results" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
          Voir les résultats agrégés →
        </Link>
      </Card>
    </div>
  );
}
