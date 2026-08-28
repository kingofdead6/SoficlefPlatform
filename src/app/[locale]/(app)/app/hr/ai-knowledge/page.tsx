import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { AssistantPanel } from '@/components/me/assistant-panel';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { AGENTS, AGENT_IDS } from '@/domain/assistant/agents';
import { navItemByHref } from '@/domain/navigation/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';
import { prisma } from '@/infrastructure/db/client';

/**
 * What feeds the assistants (`/app/hr/ai-knowledge`).
 *
 * The honest version of the specification's screen. There is no vector index to rebuild
 * and no flagged answers to review, because no model is called — so what this page shows
 * instead is exactly which platform data each agent may read, and lets HR test the one
 * agent that works.
 *
 * Listing the sources is not a consolation prize: it is the thing somebody will actually
 * need to check before trusting an answer, whether or not a model is ever plugged in.
 */

const AGENT_LABELS: Record<string, { titleFr: string; purposeFr: string }> = {
  orientation: {
    titleFr: 'Agent 1 · Accueil',
    purposeFr: 'Répond à « qui dois-je contacter pour… » depuis l’organigramme visible et l’annuaire.',
  },
  documents: {
    titleFr: 'Agent 2 · Documents',
    purposeFr: 'Retrouve une procédure ou une règle dans la bibliothèque documentaire.',
  },
  onboarding: {
    titleFr: 'Agent 3 · Parcours',
    purposeFr: 'Répond sur l’avancement du parcours d’intégration de la personne qui demande.',
  },
  training: {
    titleFr: 'Agent 4 · Formation',
    purposeFr: 'Renseigne sur les modules obligatoires et les résultats de la personne.',
  },
  competencies: {
    titleFr: 'Agent 5 · Compétences',
    purposeFr: 'Répond sur les compétences attendues d’un poste et les écarts constatés.',
  },
};

const RESOURCE_LABELS: Record<string, string> = {
  position: 'Postes',
  assignment: 'Affectations',
  organization_unit: 'Structures',
  document: 'Documents',
  onboarding_instance: 'Parcours',
  onboarding_task: 'Étapes de parcours',
  training: 'Formations',
  competency: 'Compétences',
  job_description: 'Fiches de poste',
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/app/hr/ai-knowledge');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const [documents, positions, contacts] = await Promise.all([
    prisma.document.count().catch(() => 0),
    prisma.position.count({ where: { archivedAt: null } }).catch(() => 0),
    prisma.contact.count().catch(() => 0),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Ce que chaque assistant a le droit de lire, et ce qu’il en fait. Aucun fournisseur externe n’est appelé.">
          Base de connaissance IA
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile value={AGENT_IDS.length} label="Agents définis" />
          <KpiTile value={1} label="Agents opérationnels" hint="Sans modèle de langage" />
          <KpiTile value={positions + contacts} label="Entrées interrogeables" />
          <KpiTile value={documents} label="Documents référencés" />
        </div>
      </section>

      <section>
        <SectionTitle level={2} lead="Un agent ne contourne jamais les droits : il lit avec ceux de la personne qui l’interroge.">
          Périmètre de lecture
        </SectionTitle>

        <ul className="space-y-3">
          {AGENT_IDS.map((agentId) => {
            const agent = AGENTS[agentId];
            const labels = AGENT_LABELS[agentId];
            const live = agentId === 'orientation';

            return (
              <li key={agentId}>
                <Card accent={live ? 'red' : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{labels.titleFr}</CardTitle>
                      <CardBody className="mt-1">{labels.purposeFr}</CardBody>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {agent.reads.map((resource) => (
                          <StatusBadge
                            key={resource}
                            label={RESOURCE_LABELS[resource] ?? resource}
                            tone="neutral"
                          />
                        ))}
                      </div>
                    </div>

                    <StatusBadge
                      label={live ? 'Opérationnel' : 'Structure seule'}
                      tone={live ? 'green' : 'neutral'}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionTitle level={2} lead="Posez une question à l’agent d’accueil pour vérifier ce qu’il répond, et d’où vient sa réponse.">
          Tester une question
        </SectionTitle>
        <AssistantPanel />
      </section>

      <Card>
        <CardTitle>Ré-indexation et réponses signalées</CardTitle>
        <CardBody className="mt-1">
          Sans index vectoriel, il n’y a rien à ré-indexer : l’agent 1 interroge directement
          les tables, donc une donnée modifiée est prise en compte à la question suivante.
          Les réponses signalées supposent des réponses générées ; elles viendront avec le
          fournisseur, si le choix est fait de le raccorder.
        </CardBody>
      </Card>
    </div>
  );
}
