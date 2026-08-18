import { setRequestLocale } from 'next-intl/server';

import { Card, CardBody, CardTitle, EmptyState, SectionTitle } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let jobDescription: Awaited<ReturnType<typeof loadJobDescription>> = null;

  try {
    jobDescription = await loadJobDescription();
  } catch (error) {
    console.error('Failed to load job description data:', error);
  }

  if (!jobDescription) {
    return (
      <EmptyState
        title="Fiche de poste"
        description="La fiche de poste n'est pas encore disponible."
      />
    );
  }

  return (
    <div className="space-y-8">
      <Card accent="gold">
        <CardTitle>
          {jobDescription.jobTitleFr} · {jobDescription.code}
        </CardTitle>
        <CardBody className="text-text text-[13.5px]">
          Date d&apos;application : {formatDate(jobDescription.applicationDate, locale as Locale)}
        </CardBody>
      </Card>

      <section>
        <SectionTitle>Positionnement</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle>Structure</CardTitle>
            <CardBody className="text-text">{jobDescription.positioningStructureFr}</CardBody>
          </Card>
          <Card>
            <CardTitle>Processus</CardTitle>
            <CardBody className="text-text">{jobDescription.positioningProcessFr}</CardBody>
          </Card>
          <Card>
            <CardTitle>Rattachement</CardTitle>
            <CardBody className="text-text">{jobDescription.positioningReportsToFr}</CardBody>
          </Card>
          <Card>
            <CardTitle>Subordonnés</CardTitle>
            <CardBody className="text-text">{jobDescription.positioningSubordinatesFr}</CardBody>
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle>Exigences du poste</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle>Formation</CardTitle>
            <CardBody className="text-text">{jobDescription.requirementEducationFr}</CardBody>
          </Card>
          <Card>
            <CardTitle>Formation complémentaire</CardTitle>
            <CardBody className="text-text">
              {jobDescription.requirementAdditionalEducationFr}
            </CardBody>
          </Card>
          <Card>
            <CardTitle>Expérience</CardTitle>
            <CardBody className="text-text">{jobDescription.requirementExperienceFr}</CardBody>
          </Card>
          <Card>
            <CardTitle>Régime de travail</CardTitle>
            <CardBody className="text-text">{jobDescription.requirementWorkPatternFr}</CardBody>
          </Card>
        </div>
      </section>

      {jobDescription.missions.length > 0 && (
        <section>
          <SectionTitle>Missions</SectionTitle>
          <ul className="list-disc space-y-2 ps-5">
            {jobDescription.missions.map((mission) => (
              <li key={mission.id} className="text-text text-[13.5px]">
                {mission.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}

      {jobDescription.permanentTasks.length > 0 && (
        <section>
          <SectionTitle>Tâches permanentes</SectionTitle>
          <ul className="list-disc space-y-2 ps-5">
            {jobDescription.permanentTasks.map((task) => (
              <li key={task.id} className="text-text text-[13.5px]">
                {task.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}

      {jobDescription.responsibilities.length > 0 && (
        <section>
          <SectionTitle>Responsabilités</SectionTitle>
          <ul className="list-disc space-y-2 ps-5">
            {jobDescription.responsibilities.map((responsibility) => (
              <li key={responsibility.id} className="text-text text-[13.5px]">
                {responsibility.textFr}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function loadJobDescription() {
  return prisma.jobDescription.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      missions: { orderBy: { order: 'asc' } },
      permanentTasks: { orderBy: { order: 'asc' } },
      responsibilities: { orderBy: { order: 'asc' } },
    },
  });
}
