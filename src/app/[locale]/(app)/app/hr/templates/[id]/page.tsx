import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * One onboarding path, step by step (`/app/hr/templates/[id]`).
 *
 * Grouped by phase and ordered by offset, which is the order the steps actually happen in.
 * Reordering is by editing an offset rather than by dragging: a drag makes the new
 * position implicit, and "D+15" is the thing that matters — not where the row sits on
 * screen.
 */

const PHASES = [
  { key: 'PRE_ONBOARDING' as const, label: 'Avant l’arrivée' },
  { key: 'DAY_ONE' as const, label: 'Premier jour' },
  { key: 'PROBATION' as const, label: 'Période d’essai' },
];

const DEPARTMENT: Record<string, string> = {
  HR: 'Ressources humaines',
  IT: 'Informatique',
  HSE: 'HSE',
  QUALITY: 'Qualité',
  MANAGER: 'Responsable',
  EMPLOYEE: 'Collaborateur',
};

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/templates');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const template = await prisma.onboardingTemplate
    .findUnique({
      where: { id },
      select: {
        id: true,
        titleFr: true,
        position: { select: { titleFr: true } },
        _count: { select: { instances: true } },
        milestones: {
          orderBy: [{ dayOffset: 'asc' }, { order: 'asc' }],
          select: {
            id: true,
            titleFr: true,
            detailFr: true,
            dayLabelFr: true,
            dayOffset: true,
            isRecommended: true,
            phase: true,
            ownerDepartment: true,
          },
        },
      },
    })
    .catch(() => null);

  if (!template) notFound();

  const grouped = PHASES.map((phase) => ({
    ...phase,
    milestones: template.milestones.filter((milestone) =>
      // An unphased step belongs to the probation period — the same fallback the recruit's
      // own path uses, so both views group identically.
      phase.key === 'PROBATION'
        ? milestone.phase === 'PROBATION' || milestone.phase === null
        : milestone.phase === phase.key,
    ),
  })).filter((phase) => phase.milestones.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/hr/templates" className="text-text-muted text-[12px]">
          ← Parcours types
        </Link>
        <SectionTitle
          className="mt-2"
          lead={
            template.position
              ? `Parcours type du poste « ${template.position.titleFr} ».`
              : 'Parcours type, non rattaché à un poste particulier.'
          }
        >
          {template.titleFr}
        </SectionTitle>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={`${template.milestones.length} étape${template.milestones.length > 1 ? 's' : ''}`}
            tone="neutral"
          />
          <StatusBadge
            label={`${template._count.instances} intégration${template._count.instances > 1 ? 's' : ''} rattachée${template._count.instances > 1 ? 's' : ''}`}
            tone={template._count.instances > 0 ? 'green' : 'neutral'}
          />
        </div>
      </div>

      {grouped.map((phase) => (
        <section key={phase.key}>
          <SectionTitle level={2}>{phase.label}</SectionTitle>
          <ol className="space-y-2">
            {phase.milestones.map((milestone) => (
              <li key={milestone.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{milestone.titleFr}</CardTitle>
                      <CardBody className="mt-1">{milestone.detailFr}</CardBody>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-red-strong rounded bg-(--red-dim) px-1.5 py-0.5 font-mono text-[10px]">
                        {milestone.dayLabelFr}
                      </span>
                      {milestone.ownerDepartment ? (
                        <StatusBadge
                          label={DEPARTMENT[milestone.ownerDepartment] ?? milestone.ownerDepartment}
                          tone="neutral"
                        />
                      ) : null}
                      <StatusBadge
                        label={milestone.isRecommended ? 'Recommandée' : 'Obligatoire'}
                        tone={milestone.isRecommended ? 'neutral' : 'brand'}
                      />
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <Card>
        <CardTitle>Modifier ce parcours</CardTitle>
        <CardBody className="mt-1">
          L’édition des étapes n’est pas encore ouverte : {template._count.instances}{' '}
          intégration{template._count.instances > 1 ? 's sont' : ' est'} rattachée
          {template._count.instances > 1 ? 's' : ''} à ce parcours, et modifier une étape en
          cours de route demande de décider ce qu’il advient des parcours déjà lancés — une
          règle métier à trancher avant de l’implémenter, pas un détail d’interface.
        </CardBody>
      </Card>
    </div>
  );
}
