import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * The library of onboarding paths (`/app/hr/templates`).
 *
 * A template is reusable by construction: the running journeys count shown against each
 * one is what makes editing it consequential, so it is on the card rather than hidden
 * inside.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/templates');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const templates = await prisma.onboardingTemplate
    .findMany({
      orderBy: { titleFr: 'asc' },
      select: {
        id: true,
        titleFr: true,
        slug: true,
        position: { select: { titleFr: true } },
        _count: { select: { milestones: true, instances: true } },
        milestones: {
          orderBy: { dayOffset: 'asc' },
          select: { dayOffset: true, phase: true, ownerDepartment: true },
        },
      },
    })
    .catch(() => []);

  const runningTotal = templates.reduce((sum, template) => sum + template._count.instances, 0);

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle lead="Les parcours types, par profil. Un parcours modifié s’applique aux prochaines intégrations ; celles déjà en cours gardent leurs étapes.">
          Parcours types
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={templates.length} label="Parcours" />
          <KpiTile
            value={templates.reduce((sum, template) => sum + template._count.milestones, 0)}
            label="Étapes définies"
          />
          <KpiTile value={runningTotal} label="Intégrations rattachées" />
        </div>
      </section>

      {templates.length === 0 ? (
        <Card>
          <CardBody>
            Aucun parcours type. Sans parcours, une affectation crée un compte sans checklist
            ni enquêtes.
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => {
            const span = template.milestones.length
              ? `J+${template.milestones[0].dayOffset} → J+${template.milestones[template.milestones.length - 1].dayOffset}`
              : 'aucune étape';

            const departments = [
              ...new Set(
                template.milestones
                  .map((milestone) => milestone.ownerDepartment)
                  .filter((department): department is NonNullable<typeof department> =>
                    Boolean(department),
                  ),
              ),
            ];

            return (
              <li key={template.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{template.titleFr}</CardTitle>
                      <CardBody className="mt-1">
                        {template._count.milestones} étape
                        {template._count.milestones > 1 ? 's' : ''} · {span}
                        {template.position ? ` · poste type : ${template.position.titleFr}` : ''}
                      </CardBody>

                      {departments.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {departments.map((department) => (
                            <StatusBadge key={department} label={department} tone="neutral" />
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge
                        label={`${template._count.instances} intégration${template._count.instances > 1 ? 's' : ''}`}
                        tone={template._count.instances > 0 ? 'green' : 'neutral'}
                      />
                      <Link
                        href={`/app/hr/templates/${template.id}`}
                        className="text-red-strong text-[12px] font-medium"
                      >
                        Ouvrir →
                      </Link>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
