import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { loadCatalogue, loadModule } from '@/application/training/catalogue';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import { QuizForm } from '@/components/training/quiz-form';
import {
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  KpiTile,
  ProgressBar,
  SectionTitle,
  StatusBadge,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * Training, quizzes and certificates (CDC-2026 Module 6).
 *
 * One route serves both the catalogue and a single module, selected by `?module=CODE`.
 * A separate `[code]` segment would be more idiomatic, but the module list is short and
 * always worth showing beside the lesson — splitting them would mean a round trip to get
 * back to a five-item list.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ module?: string }>;
}) {
  const { locale } = await params;
  const { module: moduleCode } = await searchParams;
  setRequestLocale(locale);

  const item = navItemByHref('/training');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const t = await getTranslations();

  const catalogue = await loadCatalogue(user).catch((error) => {
    console.error('Failed to load the training catalogue:', error);
    return null;
  });

  if (!catalogue || catalogue.entries.length === 0) {
    return <EmptyState title={t('nav.items.training')} description={t('empty.training')} />;
  }

  const selected = moduleCode ? await loadModule(user, moduleCode).catch(() => null) : null;

  return (
    <div className="space-y-8">
      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StaggerItem>
          <KpiTile value={catalogue.entries.length} label="Modules" />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            value={`${catalogue.mandatoryPassed}/${catalogue.mandatoryTotal}`}
            label="Obligatoires validés"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            value={catalogue.entries.filter((entry) => entry.certifiedAt).length}
            label="Certificats obtenus"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            value={catalogue.allMandatoryComplete ? 'Oui' : 'Non'}
            label="Parcours complet"
            hint="Toutes les formations obligatoires"
          />
        </StaggerItem>
      </Stagger>

      {catalogue.mandatoryTotal > 0 ? (
        <ProgressBar
          value={(catalogue.mandatoryPassed / catalogue.mandatoryTotal) * 100}
          label="Formations obligatoires"
          detail={`${catalogue.mandatoryPassed}/${catalogue.mandatoryTotal}`}
        />
      ) : null}

      {selected ? (
        <ModuleView selected={selected} />
      ) : (
        <section>
          <SectionTitle lead="Les modules obligatoires doivent être validés pendant la période d'intégration. Chaque tentative est conservée ; votre meilleur score compte.">
            Catalogue
          </SectionTitle>

          <Stagger as="ul" inView className="space-y-3">
            {catalogue.entries.map((entry) => (
              <StaggerItem as="li" key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-red-strong rounded bg-(--red-dim) px-1.5 py-0.5 font-mono text-[10px]">
                          {entry.code}
                        </span>
                        <CardTitle className="mb-0">{entry.titleFr}</CardTitle>
                        {entry.isMandatory ? (
                          <StatusBadge label="Obligatoire" tone="brand" />
                        ) : (
                          <StatusBadge label="Optionnelle" tone="neutral" />
                        )}
                        {entry.certifiedAt ? (
                          <StatusBadge
                            label={`Certifié le ${formatDate(entry.certifiedAt, locale as Locale)}`}
                            tone="green"
                          />
                        ) : entry.best ? (
                          <StatusBadge
                            label={`Meilleur score ${entry.best.score}%`}
                            tone={entry.best.passed ? 'green' : 'red'}
                          />
                        ) : (
                          <StatusBadge label="Non commencée" tone="neutral" />
                        )}
                      </div>
                      <CardBody className="mt-1.5">{entry.summaryFr}</CardBody>
                      <p className="text-text-dim mt-1 text-[11px]">
                        {entry.questionCount} question(s) · seuil de réussite{' '}
                        {entry.passingScore}%
                        {entry.isPlaceholder
                          ? ' · contenu provisoire, en attente du support officiel'
                          : ''}
                      </p>
                    </div>

                    <Link
                      href={{ pathname: '/training', query: { module: entry.code } }}
                      className="shrink-0 rounded bg-(--red-brand) px-3 py-1.5 text-[12px] font-medium text-white"
                    >
                      {entry.best ? 'Revoir' : 'Commencer'}
                    </Link>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}

function ModuleView({
  selected,
}: {
  selected: NonNullable<Awaited<ReturnType<typeof loadModule>>>;
}) {
  return (
    <div className="space-y-6">
      <p>
        <Link href="/training" className="text-red-strong text-[12px] underline">
          ← Retour au catalogue
        </Link>
      </p>

      <section>
        <SectionTitle lead={selected.summaryFr}>{selected.titleFr}</SectionTitle>

        {selected.isPlaceholder ? (
          <Card accent="brand" className="mb-4">
            <CardBody>
              <strong>Contenu provisoire.</strong> Ce module reprend les informations
              publiques et les données déjà extraites, en attendant le support officiel de
              SOFICLEF. Le parcours, le questionnaire et la certification fonctionnent ; seul
              le contenu sera remplacé.
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardBody className="text-text whitespace-pre-line">{selected.contentFr}</CardBody>
        </Card>
      </section>

      <section>
        <SectionTitle
          level={3}
          lead={`Seuil de réussite : ${selected.passingScore}%. ${
            selected.best
              ? `Votre meilleur score : ${selected.best.score}%.`
              : 'Première tentative.'
          }`}
        >
          Questionnaire
        </SectionTitle>
        <QuizForm
          moduleId={selected.id}
          questions={selected.questions}
          passingScore={selected.passingScore}
        />
      </section>

      <p className="text-text-dim text-[11px]">
        Chaque tentative est conservée et horodatée ; le certificat porte la date de votre
        première réussite.
      </p>
    </div>
  );
}
