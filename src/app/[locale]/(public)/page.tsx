import { getTranslations, setRequestLocale } from 'next-intl/server';

import { loadPublicCompany, loadPublicValues } from '@/application/public/presentation';
import { LockHero } from '@/components/motion/lock-hero';
import { RevealTimeline } from '@/components/motion/reveal-timeline';
import { ScrollScene } from '@/components/motion/scroll-scene';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { DemoBlock } from '@/components/public/demo-block';
import { CompetencyGrid } from '@/components/public/demos/competency-grid';
import { JourneyTrack } from '@/components/public/demos/journey-track';
import { OrgLines } from '@/components/public/demos/org-lines';
import { SourceText } from '@/components/public/source-text';
import { Card, CardBody, CardTitle, KpiTile } from '@/components/ui';
import { Link } from '@/i18n/navigation';

/**
 * The anonymous landing page.
 *
 * It replaces the redirect that used to sit here: an unauthenticated visitor was bounced
 * straight to the sign-in form, which is right for a private tool and wrong for the front
 * door of a company that publishes this material anyway.
 *
 * The three `DemoBlock` sections each animate the module they describe rather than
 * decorating it — the competency matrix fills, the structure draws itself, the journey is
 * dragged. Motion of this weight is confined to this page: `(app)` keeps the 8px, 240ms
 * vocabulary in `lib/motion.ts`, because somebody working in the tool all day is not the
 * audience for a hero.
 */
export default async function PublicHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('public');

  const [company, values] = await Promise.all([
    loadPublicCompany().catch(() => null),
    loadPublicValues().catch(() => []),
  ]);

  return (
    <div className="space-y-20">
      <RevealTimeline as="section" className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
        <div>
          <p
            data-reveal
            className="text-red-strong font-mono text-[11px] tracking-[0.16em] uppercase"
          >
            {t('hero.eyebrow')}
          </p>
          <h1
            data-reveal
            className="font-display text-text mt-3 text-4xl leading-tight text-balance sm:text-5xl"
          >
            {t('hero.title')}
          </h1>
          <p data-reveal className="text-text-muted mt-4 max-w-2xl text-[15px] leading-relaxed">
            {t('hero.lead')}
          </p>
          <p data-reveal className="mt-6">
            <Link
              href="/login"
              className="inline-block rounded bg-(--red-brand) px-4 py-2 text-[13px] font-medium text-white"
            >
              {t('hero.cta')}
            </Link>
          </p>
        </div>

        <div data-reveal className="justify-self-center lg:justify-self-end">
          <LockHero />
        </div>
      </RevealTimeline>

      {company ? (
        <Stagger as="section" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StaggerItem>
            <KpiTile value={company.foundedYear} label="Fondée" hint={company.foundedCity} />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value="ISO" label="9001:2015" hint="Certifiée depuis 2017" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value="OEA" label="Statut" hint="Opérateur Économique Agréé" />
          </StaggerItem>
          <StaggerItem>
            <KpiTile value={company.activities.length} label="Pôles d'activité" />
          </StaggerItem>
        </Stagger>
      ) : null}

      <ScrollScene>
        <DemoBlock
          eyebrow={t('demos.matrix.eyebrow')}
          title={t('demos.matrix.title')}
          panel={<CompetencyGrid />}
        >
          {t('demos.matrix.body')}
        </DemoBlock>
      </ScrollScene>

      <ScrollScene>
        <DemoBlock
          flip
          eyebrow={t('demos.structure.eyebrow')}
          title={t('demos.structure.title')}
          panel={<OrgLines />}
        >
          {t('demos.structure.body')}
        </DemoBlock>
      </ScrollScene>

      <ScrollScene>
        <DemoBlock
          eyebrow={t('demos.journey.eyebrow')}
          title={t('demos.journey.title')}
          panel={<JourneyTrack />}
        >
          {t('demos.journey.body')}
        </DemoBlock>
      </ScrollScene>

      {company ? (
        <ScrollScene className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardTitle>{t('company.vision')}</CardTitle>
            <CardBody className="text-text mt-1">
              <SourceText>{company.visionFr}</SourceText>
            </CardBody>
          </Card>
          <Card>
            <CardTitle>{t('company.mission')}</CardTitle>
            <CardBody className="text-text mt-1">
              <SourceText>{company.missionFr}</SourceText>
            </CardBody>
          </Card>
        </ScrollScene>
      ) : null}

      {values.length > 0 ? (
        <section>
          <h2 className="font-display text-text mb-5 text-2xl">{t('company.values')}</h2>
          <Stagger as="ul" inView className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {values.map((value) => (
              <StaggerItem
                as="li"
                key={value.rank}
                className="flex items-start gap-4 rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3"
              >
                <span className="text-red-brand font-mono text-xl leading-none">
                  {String(value.rank).padStart(2, '0')}
                </span>
                <span>
                  {/* The one content the client supplied in Arabic themselves, so it is
                      shown as written rather than falling back to French (ADR-026). */}
                  <span
                    dir="rtl"
                    lang="ar"
                    className="text-red-brand block text-[14px] font-semibold"
                  >
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
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ) : null}
    </div>
  );
}