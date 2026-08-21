import { setRequestLocale } from 'next-intl/server';

import { TranslatableText } from '@/components/i18n/translation-pending';
import { Card, CardBody, CardTitle, EmptyState, SectionTitle } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import { prisma } from '@/infrastructure/db/client';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  let company: Awaited<ReturnType<typeof loadCompany>> = null;

  try {
    company = await loadCompany();
  } catch (error) {
    console.error('Failed to load company data:', error);
  }

  if (!company) {
    return (
      <EmptyState
        title="Entreprise"
        description="Les informations sur l'entreprise ne sont pas encore disponibles."
      />
    );
  }

  return (
    <div className="space-y-8">
      <Card accent="brand">
        <CardTitle>{company.legalName}</CardTitle>
        <CardBody className="text-text space-y-1 text-[13.5px]">
          <p>
            {company.legalForm} · Fondée en {company.foundedYear} à {company.foundedCity}
          </p>
          <p>Siège : {company.headquarters}</p>
          <p>Direction générale : {company.generalManager}</p>
          <p>
            Certification : {company.certification} · Statut : {company.status}
          </p>
          <p>
            <a
              href={
                company.website.startsWith('http') ? company.website : `https://${company.website}`
              }
              target="_blank"
              rel="noreferrer"
              className="text-blue underline"
            >
              {company.website}
            </a>
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Vision</CardTitle>
          <CardBody className="text-text">{company.visionFr}</CardBody>
        </Card>
        <Card>
          <CardTitle>Mission</CardTitle>
          <CardBody className="text-text">{company.missionFr}</CardBody>
        </Card>
      </div>

      {company.activities.length > 0 && (
        <section>
          <SectionTitle>Activités</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {company.activities.map((activity) => (
              <Card key={activity.id}>
                <CardTitle>{activity.labelFr}</CardTitle>
                <CardBody>{activity.contentFr}</CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      {company.values.length > 0 && (
        <section>
          <SectionTitle lead="Charte de Management">Nos valeurs</SectionTitle>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {company.values.map((value) => (
              <li key={value.id}>
                <Card className="flex items-center gap-3">
                  <span className="text-red-brand font-mono text-lg tabular-nums">{value.rank}</span>
                  <TranslatableText
                    field={{ fr: value.nameFr, ar: value.nameAr, en: value.nameEn }}
                    locale={locale as Locale}
                    className="text-text text-[13.5px] font-medium"
                  />
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

async function loadCompany() {
  const company = await prisma.company.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { activities: { orderBy: { order: 'asc' } } },
  });
  if (!company) return null;

  const values = await prisma.companyValue.findMany({ orderBy: { rank: 'asc' } });

  return { ...company, values };
}
