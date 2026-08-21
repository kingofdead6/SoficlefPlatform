import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { loadDashboard } from '@/application/dashboard/kpis';
import { canOpen } from '@/application/navigation/build-navigation';
import { Stagger, StaggerItem } from '@/components/motion/stagger';
import {
  Card,
  CardBody,
  CardTitle,
  KpiTile,
  ProgressBar,
  SectionTitle,
  StatusBadge,
} from '@/components/ui';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The role-aware dashboard (CDC v0.1 §10).
 *
 * Each block is rendered only when the reader holds the permission behind it, so the
 * page composes itself per role rather than showing everybody the same grid with zeros
 * where their rights end.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/dashboard');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const t = await getTranslations();

  const data = await loadDashboard(user).catch((error) => {
    console.error('Failed to load the dashboard:', error);
    return null;
  });

  if (!data) {
    return (
      <Card>
        <CardBody>{t('errors.serverErrorLead')}</CardBody>
      </Card>
    );
  }

  const nothingToShow =
    !data.jobDescriptions && !data.competencies && !data.onboarding && !data.quality;

  if (nothingToShow) {
    return (
      <Card>
        <CardBody>{t('empty.dashboard')}</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      <p className="text-text-muted -mt-2 text-[13px]">
        Bonjour {user.displayName.split('—')[0]?.trim()}. Voici l&apos;état de votre périmètre.
      </p>

      {data.onboarding ? (
        <section>
          <SectionTitle lead="Parcours d'intégration de votre périmètre.">Intégration</SectionTitle>
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StaggerItem>
              <KpiTile value={data.onboarding.journeys} label="Parcours suivis" />
            </StaggerItem>
            <StaggerItem>
              <KpiTile value={`${data.onboarding.averagePercent}%`} label="Progression moyenne" />
            </StaggerItem>
            <StaggerItem>
              <KpiTile value={data.onboarding.overdueTasks} label="Tâches en retard" />
            </StaggerItem>
            <StaggerItem>
              <KpiTile value={data.onboarding.blockedTasks} label="Tâches bloquées" />
            </StaggerItem>
          </Stagger>
          <ProgressBar
            className="mt-4"
            value={data.onboarding.averagePercent}
            label="Progression moyenne des parcours"
          />
          <p className="mt-3">
            <Link href="/onboarding" className="text-red-strong text-[12px] underline">
              Voir les parcours
            </Link>
          </p>
        </section>
      ) : null}

      {data.competencies ? (
        <section>
          <SectionTitle lead="Écarts entre les niveaux attendus et les niveaux acquis.">
            Compétences
          </SectionTitle>
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StaggerItem>
              <KpiTile value={data.competencies.total} label="Liens emploi–compétence" />
            </StaggerItem>
            <StaggerItem>
              <KpiTile
              value={
                data.competencies.conformity === null ? '—' : `${data.competencies.conformity}%`
              }
              label="Conformité"
              hint="Sur les compétences évaluées"
            />
            </StaggerItem>
            <StaggerItem>
              <KpiTile value={data.competencies.critical} label="Écarts critiques" />
            </StaggerItem>
            <StaggerItem>
              <KpiTile value={data.competencies.unassessed} label="Non évaluées" />
            </StaggerItem>
          </Stagger>
          <p className="mt-3">
            <Link href="/competencies" className="text-red-strong text-[12px] underline">
              Voir la matrice
            </Link>
          </p>
        </section>
      ) : null}

      {data.jobDescriptions ? (
        <section>
          <SectionTitle lead="Couverture et statut des fiches de poste.">
            Fiches de poste
          </SectionTitle>
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StaggerItem>
              <KpiTile value={data.jobDescriptions.total} label="Fiches" />
            </StaggerItem>
            <StaggerItem>
              <KpiTile value={`${data.jobDescriptions.coverage}%`} label="Validées" />
            </StaggerItem>
            <StaggerItem>
              <KpiTile value={data.jobDescriptions.draft} label="En cours de rédaction" />
            </StaggerItem>
            {data.validation ? (
              <StaggerItem>
                <KpiTile
                  value={data.validation.pendingJobDescriptions}
                  label="En attente de validation"
                  hint="Votre file"
                />
              </StaggerItem>
            ) : null}
          </Stagger>
        </section>
      ) : null}

      {data.quality ? (
        <section>
          <SectionTitle lead="Ce qui manque au référentiel — chaque ligne est une action possible.">
            Qualité des données
          </SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardTitle>Structures sans responsable</CardTitle>
              <CardBody className="mt-1 flex items-center gap-3">
                <span className="text-red-brand font-mono text-xl">{data.quality.unitsWithoutHead}</span>
                {data.quality.unitsWithoutHead > 0 ? (
                  <StatusBadge label="À pourvoir" tone="red" />
                ) : (
                  <StatusBadge label="Complet" tone="green" />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardTitle>Emplois sans fiche de poste</CardTitle>
              <CardBody className="mt-1 flex items-center gap-3">
                <span className="text-red-brand font-mono text-xl">
                  {data.quality.jobsWithoutDescription}
                </span>
                {data.quality.jobsWithoutDescription > 0 ? (
                  <StatusBadge label="À documenter" tone="brand" />
                ) : (
                  <StatusBadge label="Complet" tone="green" />
                )}
              </CardBody>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}
