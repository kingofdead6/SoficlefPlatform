import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import {
  Card,
  CardBody,
  CardTitle,
  DataTable,
  EmptyState,
  KpiTile,
  Modal,
  SectionTitle,
  StatusBadge,
  Stepper,
  Tabs,
  Timeline,
  type Column,
} from '@/components/ui';
import { Drawer } from '@/components/ui/drawer';
import { devPagesEnabled } from '@/lib/dev-pages';

/**
 * The component gallery — development only (ADR-038).
 *
 * Every shared component appears here in the state it will actually be used in, so a
 * regression is visible on one screen and in three locales. Switch to /ar to check the
 * mirroring; tab through to check focus order.
 */
export const dynamic = 'force-dynamic';

interface DemoRow {
  code: string;
  structure: string;
  head: string;
  vacant: boolean;
}

const ROWS: DemoRow[] = [
  { code: 'DPR-FAB', structure: 'Structure Fabrication', head: 'OUDNI Yassine', vacant: true },
  { code: 'DPR-CQ', structure: 'Structure Contrôle Qualité', head: 'BELLAL Yousfi', vacant: true },
  { code: 'DPR-MNT', structure: 'Structure Maintenance', head: 'ATTOU Fares', vacant: true },
];

export default async function ComponentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!devPagesEnabled()) notFound();

  const t = await getTranslations();

  const columns: Column<DemoRow>[] = [
    { key: 'code', header: 'Code', mono: true, render: (row) => row.code },
    { key: 'structure', header: 'Structure', render: (row) => row.structure },
    { key: 'head', header: 'Responsable', render: (row) => row.head },
    {
      key: 'status',
      header: 'Statut',
      align: 'end',
      render: (row) => (
        <StatusBadge
          label={row.vacant ? t('status.vacant') : t('status.occupied')}
          tone={row.vacant ? 'red' : 'green'}
        />
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-5xl p-8">
      <header className="mb-10">
        <p className="text-text-dim font-mono text-xs tracking-widest uppercase">
          SOFICLEF · Design system
        </p>
        <h1 className="font-display text-text text-3xl">Composants</h1>
        <p className="text-text-muted mt-2 max-w-prose text-[13.5px]">
          Chaque composant est construit sur les tokens, sûr en RTL et navigable au clavier.
          Basculez en <code>/ar</code> pour vérifier le miroir, et parcourez la page à la touche Tab
          pour vérifier l&apos;ordre de focus.
        </p>
      </header>

      <section className="mb-10">
        <SectionTitle level={3} lead="Titre de section avec accent et chapeau.">
          SectionTitle
        </SectionTitle>
        <SectionTitle level={3} accent="2024–2026" lead="Variante avec fragment accentué.">
          Plan Stratégique
        </SectionTitle>
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>Card</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardTitle>Identité</CardTitle>
            <CardBody>
              <strong className="text-text">Forme :</strong> SARL ·{' '}
              <strong className="text-text">Fondée :</strong> 1994
            </CardBody>
          </Card>
          <Card accent="gold">
            <CardTitle>Callout</CardTitle>
            <CardBody>
              Bordure d&apos;accent sur le bord de début : elle passe à droite en arabe.
            </CardBody>
          </Card>
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>KpiTile</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiTile value="2026" label="Prise de poste" />
          <KpiTile value="ISO" label="9001:2015" />
          <KpiTile value="+60%" label="Part production" />
          <KpiTile value="30J" label="Intégration" />
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>StatusBadge</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={t('status.vacant')} tone="red" />
          <StatusBadge label={t('status.validated')} tone="green" />
          <StatusBadge label={t('status.inProgress')} tone="gold" />
          <StatusBadge label={t('status.draft')} tone="neutral" />
          <StatusBadge label={t('status.inReview')} tone="blue" />
        </div>
        <p className="text-text-muted mt-2 text-[12px]">
          Le libellé est obligatoire dans l&apos;API : il n&apos;existe pas de variante portée par
          la couleur seule.
        </p>
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>DataTable</SectionTitle>
        <DataTable
          columns={columns}
          rows={ROWS}
          getRowKey={(row) => row.code}
          emptyLabel={t('components.dataTable.empty')}
          caption="Structures de la Direction de Production"
        />
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>Timeline</SectionTitle>
        <Timeline
          label={t('components.timeline.label')}
          entries={[
            { id: '1', marker: 'J+1', title: 'Accueil officiel', detail: 'Rencontre avec le DG' },
            { id: '2', marker: 'J+3', title: 'Rencontre DRH', detail: 'État des recrutements' },
            {
              id: '3',
              marker: 'J+30',
              title: 'Bilan au DG',
              status: <StatusBadge label={t('status.recommended')} tone="gold" />,
            },
          ]}
        />
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>Stepper</SectionTitle>
        <Stepper
          label={t('components.stepper.step', { current: 2, total: 4 })}
          doneLabel={t('components.stepper.completed')}
          steps={[
            { id: '1', label: 'Brouillon', state: 'done' },
            { id: '2', label: 'En revue', state: 'current' },
            { id: '3', label: 'Validée', state: 'upcoming' },
            { id: '4', label: 'Archivée', state: 'upcoming' },
          ]}
        />
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>Tabs</SectionTitle>
        <Tabs
          label={t('components.tabs.label')}
          items={[
            { value: 'fab', label: 'Fabrication', content: <p>Unités Coffre et Brouette.</p> },
            {
              value: 'cq',
              label: 'Contrôle Qualité',
              content: <p>CQ matières et produits finis.</p>,
            },
            { value: 'mnt', label: 'Maintenance', content: <p>Préventive et curative, CNC.</p> },
          ]}
        />
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>Modal &amp; Drawer</SectionTitle>
        <div className="flex flex-wrap gap-3">
          <Modal
            title="Fiche de poste EN-012-DRH"
            description="Aperçu de la version courante."
            closeLabel={t('components.modal.close')}
            trigger={
              <button
                type="button"
                className="text-gold rounded-md border border-(--gold) bg-(--gold-dim) px-3 py-1.5 text-[13px]"
              >
                Ouvrir la modale
              </button>
            }
          >
            Le contenu réel arrive en Partie 6.
          </Modal>

          <Drawer
            title="Panneau latéral"
            closeLabel={t('components.drawer.close')}
            trigger={
              <button
                type="button"
                className="text-text-muted rounded-md border border-(--border) px-3 py-1.5 text-[13px]"
              >
                Ouvrir le panneau
              </button>
            }
          >
            <div className="text-text-muted p-5 text-[13px]">
              Le panneau entre par le bord de début : à gauche en français, à droite en arabe.
            </div>
          </Drawer>
        </div>
      </section>

      <section className="mb-10">
        <SectionTitle level={3}>EmptyState</SectionTitle>
        <EmptyState title={t('nav.items.competencies')} description={t('empty.competencies')} />
      </section>
    </main>
  );
}
