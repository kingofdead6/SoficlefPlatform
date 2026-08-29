import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { canOpen } from '@/application/navigation/build-navigation';
import { Card, CardBody, CardTitle, KpiTile, SectionTitle, StatusBadge } from '@/components/ui';
import { AGENTS, AGENT_IDS } from '@/domain/assistant/agents';
import { connectorStatuses } from '@/domain/admin/connectors';
import { navItemByHref } from '@/domain/navigation/navigation';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/infrastructure/auth/current-user';

/**
 * AI configuration (`/admin/ai`).
 *
 * No provider is configured and none is called (ADR-003), so this page configures nothing
 * yet. What it does instead is state precisely what each agent is allowed to read, which
 * is the thing worth checking before any provider is ever plugged in — the permissions
 * are the durable part, the endpoint is not.
 */

const AGENT_LABELS: Record<string, { titleFr: string; purposeFr: string; live: boolean }> = {
  orientation: {
    titleFr: 'Agent 1 · Accueil',
    purposeFr: '« À qui m’adresser pour… », depuis l’organigramme visible et l’annuaire.',
    live: true,
  },
  documents: {
    titleFr: 'Agent 2 · Documents',
    purposeFr: 'Retrouver une procédure dans la bibliothèque documentaire.',
    live: false,
  },
  onboarding: {
    titleFr: 'Agent 3 · Parcours',
    purposeFr: 'Répondre sur l’avancement du parcours de celui qui demande.',
    live: false,
  },
  training: {
    titleFr: 'Agent 4 · Formation',
    purposeFr: 'Modules obligatoires et résultats de la personne.',
    live: false,
  },
  competencies: {
    titleFr: 'Agent 5 · Compétences',
    purposeFr: 'Compétences attendues d’un poste et écarts constatés.',
    live: false,
  },
};

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const item = navItemByHref('/admin/ai');
  const user = await getCurrentUser();
  if (!item || !user || !canOpen(user, item)) notFound();

  const ai = connectorStatuses(process.env).find((status) => status.definition.id === 'ai');
  const configured = ai?.mode === 'production';

  return (
    <div className="space-y-10">
      <section>
        <SectionTitle lead="Ce que les assistants ont le droit de lire, et l’état du fournisseur qui leur manque.">
          Configuration IA
        </SectionTitle>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiTile value={AGENT_IDS.length} label="Agents déclarés" />
          <KpiTile value={1} label="Agents opérationnels" hint="Sans modèle de langage" />
          <KpiTile
            value={configured ? 'Oui' : 'Non'}
            label="Fournisseur raccordé"
            hint={configured ? undefined : 'Aucun appel externe'}
          />
        </div>
      </section>

      <Card accent={configured ? undefined : 'red'}>
        <CardTitle>Fournisseur de modèle de langage</CardTitle>
        <CardBody className="mt-1">
          {configured
            ? 'Un fournisseur est configuré. Les agents peuvent être activés un par un.'
            : 'Aucun fournisseur n’est configuré, et c’est une décision d’architecture plutôt qu’un oubli : aucune fonction métier ne doit dépendre d’un service externe tant qu’il n’est pas contractualisé. Les agents ci-dessous fonctionnent donc par recherche dans les données, ou pas encore.'}
        </CardBody>
        <p className="text-text-dim mt-2 font-mono text-[11px]">
          {ai?.definition.envVar ?? 'AI_PROVIDER_ENDPOINT'}
        </p>
      </Card>

      <section>
        <SectionTitle level={2} lead="Un agent lit avec les droits de celui qui l’interroge : il ne peut jamais faire remonter une ligne que la personne ne pourrait pas ouvrir elle-même.">
          Agents et périmètre de lecture
        </SectionTitle>

        <ul className="space-y-3">
          {AGENT_IDS.map((agentId) => {
            const labels = AGENT_LABELS[agentId];
            return (
              <li key={agentId}>
                <Card accent={labels.live ? 'red' : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle>{labels.titleFr}</CardTitle>
                      <CardBody className="mt-1">{labels.purposeFr}</CardBody>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {AGENTS[agentId].reads.map((resource) => (
                          <StatusBadge key={resource} label={resource} tone="neutral" />
                        ))}
                      </div>
                    </div>
                    <StatusBadge
                      label={labels.live ? 'Opérationnel' : 'En attente du fournisseur'}
                      tone={labels.live ? 'green' : 'neutral'}
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Quotas et modèles</CardTitle>
          <CardBody className="mt-1">
            Sans fournisseur, il n’y a ni modèle à choisir ni quota à fixer. Ces réglages
            arriveront avec le raccordement, où ils auront un effet mesurable.
          </CardBody>
        </Card>

        <Card>
          <CardTitle>Modèles de prompts</CardTitle>
          <CardBody className="mt-1">
            De même. La règle qui, elle, existe déjà : toute réponse doit citer sa source ou
            reconnaître qu’elle n’a rien trouvé — elle est vérifiée dans le code, pas
            seulement écrite dans un prompt.
          </CardBody>
          <Link href="/app/hr/ai-knowledge" className="text-red-strong mt-2 inline-block text-[12px] font-medium">
            Base de connaissance →
          </Link>
        </Card>
      </div>
    </div>
  );
}
