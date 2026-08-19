import { getTranslations, setRequestLocale } from 'next-intl/server';

import { loadPublicCompany, loadPublicValues } from '@/application/public/presentation';
import { SourceText } from '@/components/public/source-text';
import { Card, CardBody, CardTitle, EmptyState, SectionTitle } from '@/components/ui';

/** The company's public presentation: identity, vision, activities, values. */
export default async function PublicCompany({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('public');

  const [company, values] = await Promise.all([
    loadPublicCompany().catch(() => null),
    loadPublicValues().catch(() => []),
  ]);

  if (!company) {
    return <EmptyState title={t('company.title')} description={t('careers.empty')} />;
  }

  return (
    <div className="space-y-10">
      <SectionTitle lead={t('company.lead')}>{t('company.title')}</SectionTitle>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>{t('company.identity')}</CardTitle>
          <CardBody className="text-text mt-1 space-y-1">
            <p>
              {company.legalName} · {company.legalForm}
            </p>
            <p>
              Fondée en {company.foundedYear} à {company.foundedCity}
            </p>
            <p>Siège : {company.headquarters}</p>
            <p>Certification : {company.certification}</p>
            <p>Statut : {company.status}</p>
            <p>
              <a
                href={
                  company.website.startsWith('http')
                    ? company.website
                    : `https://${company.website}`
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

        <Card>
          <CardTitle>{t('company.visionMission')}</CardTitle>
          <CardBody className="text-text mt-1 space-y-3">
            <span className="block">
              <strong className="text-gold-strong block text-[12px]">{t('company.vision')}</strong>
              <SourceText>{company.visionFr}</SourceText>
            </span>
            <span className="block">
              <strong className="text-gold-strong block text-[12px]">{t('company.mission')}</strong>
              <SourceText>{company.missionFr}</SourceText>
            </span>
          </CardBody>
        </Card>
      </section>

      {company.activities.length > 0 ? (
        <section>
          <SectionTitle level={3}>{t('company.activities')}</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {company.activities.map((activity) => (
              <Card key={activity.labelFr}>
                <CardTitle>{activity.labelFr}</CardTitle>
                <CardBody className="text-text mt-1">
                  <SourceText>{activity.contentFr}</SourceText>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {values.length > 0 ? (
        <section>
          <SectionTitle level={3}>{t('company.values')}</SectionTitle>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {values.map((value) => (
              <li
                key={value.rank}
                className="flex items-start gap-4 rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3"
              >
                <span className="text-gold font-mono text-xl leading-none">
                  {String(value.rank).padStart(2, '0')}
                </span>
                <span>
                  <span dir="rtl" lang="ar" className="text-gold block text-[14px] font-semibold">
                    {value.nameAr}
                  </span>
                  <SourceText className="text-text mt-0.5 block text-[13px]">
                    {value.nameFr}
                  </SourceText>
                  {value.nameEn ? (
                    <span lang="en" className="text-text-dim mt-0.5 block text-[12px]">
                      {value.nameEn}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
