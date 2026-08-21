import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { loadJobMatrix } from '@/application/competency/matrix';
import { canOpen } from '@/application/navigation/build-navigation';
import { AssessmentDialog } from '@/components/competency/assessment-dialog';
import {
  Card,
  CardBody,
  DataTable,
  EmptyState,
  KpiTile,
  LevelMeter,
  SectionTitle,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { can } from '@/domain/auth/authorization';
import { navItemByHref } from '@/domain/navigation/navigation';
import type { GapStatus } from '@/domain/competency/gap';
import type { Locale } from '@/i18n/config';
import { formatDate } from '@/lib/format';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * The job–competency matrix and the gaps it produces (CDC v0.1 §7.1).
 *
 * Levels are drawn *and* written *and* labelled for assistive technology, and the status
 * carries its own word — §7.1 forbids a level that depends on colour alone.
 */

const STATUS_PRESENTATION: Record<
  GapStatus,
  { label: string; tone: 'green' | 'brand' | 'red' | 'neutral' }
> = {
  conforme: { label: 'Conforme', tone: 'green' },
  'a-developper': { label: 'À développer', tone: 'brand' },
  critique: { label: 'Critique', tone: 'red' },
  'non-evalue': { label: 'Non évalué', tone: 'neutral' },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  // The page is the boundary, not the sidebar (ADR-020).
  const item = navItemByHref('/competencies');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const matrix = await loadJobMatrix(user).catch((error) => {
    console.error('Failed to load the competency matrix:', error);
    return null;
  });

  if (!matrix || matrix.rows.length === 0) {
    return (
      <EmptyState
        title="Bilan des compétences"
        description="Aucune compétence n'est encore rattachée à votre emploi. Le référentiel se remplit depuis Administration › Compétences."
      />
    );
  }

  const mayAssess = can(user, 'assess', 'assessment', {
    organizationUnitId: matrix.organizationUnitId,
    ownerUserId: user.id,
  });

  const columns: Column<(typeof matrix.rows)[number]>[] = [
    {
      key: 'competency',
      header: 'Compétence',
      render: (row) => (
        <div>
          <div className="text-text font-medium">{row.nameFr}</div>
          <div className="text-text-dim mt-0.5 text-[11px]">
            {row.familyFr ?? '—'}
            {row.mandatory ? ' · Obligatoire' : ' · Optionnelle'}
          </div>
        </div>
      ),
    },
    {
      key: 'required',
      header: 'Niveau attendu',
      render: (row) => (
        <LevelMeter
          value={row.requiredLevel}
          max={matrix.maxLevel}
          label={`${row.nameFr}, niveau attendu`}
          tone="brand"
        />
      ),
    },
    {
      key: 'actual',
      header: 'Niveau acquis',
      render: (row) => (
        <LevelMeter
          value={row.gap.actualLevel}
          max={matrix.maxLevel}
          label={`${row.nameFr}, niveau acquis`}
          tone={row.gap.status === 'critique' ? 'red' : 'green'}
        />
      ),
    },
    {
      key: 'gap',
      header: 'Écart',
      align: 'end',
      mono: true,
      render: (row) => (row.gap.gap === null ? '—' : row.gap.gap === 0 ? '0' : `−${row.gap.gap}`),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => (
        <StatusBadge
          label={STATUS_PRESENTATION[row.gap.status].label}
          tone={STATUS_PRESENTATION[row.gap.status].tone}
        />
      ),
    },
    {
      key: 'assessed',
      header: 'Évalué le',
      mono: true,
      render: (row) =>
        row.lastAssessedAt ? formatDate(row.lastAssessedAt, locale as Locale) : '—',
    },
    ...(mayAssess
      ? [
          {
            key: 'action',
            header: 'Action',
            align: 'end' as const,
            render: (row: (typeof matrix.rows)[number]) => (
              <AssessmentDialog
                competencyId={row.competencyId}
                competencyName={row.nameFr}
                subjectUserId={user.id}
                currentLevel={row.gap.actualLevel}
                maxLevel={matrix.maxLevel}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile value={matrix.summary.total} label="Compétences" hint={matrix.jobTitleFr} />
        <KpiTile
          value={matrix.summary.conformityRate === null ? '—' : `${matrix.summary.conformityRate}%`}
          label="Conformité"
          hint="Sur les compétences évaluées"
        />
        <KpiTile value={matrix.summary.critique} label="Écarts critiques" />
        <KpiTile value={matrix.summary.nonEvalue} label="Non évaluées" />
      </div>

      <section>
        <SectionTitle
          lead={`Emploi ${matrix.jobCode} — niveau attendu, niveau acquis et écart pour chaque compétence. L'écart est calculé sur l'échelle configurée (1 à ${matrix.maxLevel}).`}
        >
          Matrice emploi–compétences
        </SectionTitle>
        <DataTable
          columns={columns}
          rows={matrix.rows}
          getRowKey={(row) => row.competencyId}
          emptyLabel="Aucune compétence rattachée à cet emploi."
          caption={`Matrice des compétences de l'emploi ${matrix.jobTitleFr}`}
        />
      </section>

      <Card>
        <CardBody>
          Ce référentiel est une <strong>proposition</strong> issue du cahier des charges (§7.2).
          Les intitulés définitifs, l&apos;échelle de niveaux et le caractère obligatoire de chaque
          compétence doivent être validés par la Structure Compétences &amp; Emplois avant mise en
          service.
        </CardBody>
      </Card>
    </div>
  );
}
