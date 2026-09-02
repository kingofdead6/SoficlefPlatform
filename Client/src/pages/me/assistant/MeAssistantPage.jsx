import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { assistantApi } from '../../../api/assistant.js';
import { onboardingApi } from '../../../api/onboarding.js';
import AssistantChat, { ProviderNote } from '../../../components/assistant/AssistantChat.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * /app/me/assistant — Assistant (route guide §2.1, CORE).
 *
 * The employee's agents: orientation (who to talk to), onboarding (their own journey),
 * training (the catalogue and their own results), plus documents and competencies, which are
 * open to every account type. Which of these actually appear is decided by the server from
 * each agent's declared `reads` and this caller's permissions (`available`), not by a role
 * test written here — a page that hardcoded the list would drift from the permission
 * catalogue the first time a role changed.
 *
 * Every agent answers by *retrieval first*, over rows this reader could already open. When a
 * language model is configured it rephrases what retrieval found and nothing more; the cited
 * sources always come from retrieval, so a citation can never be invented. With no provider
 * configured the assistant still answers — plainer, listing the matched rows — which is why
 * the copy below is driven by the `provider` field rather than asserting either state.
 */

/** Openers per agent, showing what each can really answer rather than inviting free chat. */
const SUGGESTIONS = {
  orientation: [
    'Qui est responsable de la qualité ?',
    'À qui m’adresser pour mon badge ?',
    'Qui gère les ressources humaines ?',
  ],
  onboarding: [
    'Quelles étapes de mon parcours restent à faire ?',
    'Qu’est-ce qui est en retard ?',
    'Que dois-je faire cette semaine ?',
  ],
  training: [
    'Quels modules sont obligatoires ?',
    'Où en suis-je dans mes formations ?',
    'Quel est le seuil de réussite ?',
  ],
  documents: [
    'Où trouver le règlement intérieur ?',
    'Quelle procédure pour les congés ?',
    'Où est la charte informatique ?',
  ],
  competencies: [
    'Quelles compétences mon poste demande-t-il ?',
    'Quels sont mes écarts de compétences ?',
  ],
};

const PLACEHOLDERS = {
  orientation: 'Ex. : qui s’occupe des contrats de travail ?',
  onboarding: 'Ex. : quelles étapes me restent à faire ?',
  training: 'Ex. : quels modules dois-je encore valider ?',
  documents: 'Ex. : où est la procédure de congés ?',
  competencies: 'Ex. : quelles compétences sont attendues à mon poste ?',
};

/** The agents this page offers, in the order they matter to a new arrival. */
const PAGE_AGENTS = ['orientation', 'onboarding', 'training', 'documents', 'competencies'];

export default function MeAssistantPage() {
  const [agents, setAgents] = useState([]);
  const [provider, setProvider] = useState(null);
  const [modelName, setModelName] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [agentsRes, overviewRes] = await Promise.all([
          assistantApi.agents(),
          onboardingApi.meOverview().catch(() => ({ data: null })),
        ]);
        setAgents(agentsRes.data ?? []);
        setProvider(agentsRes.provider ?? null);
        setModelName(agentsRes.modelName ?? null);
        setOverview(overviewRes.data);
      } catch {
        setError("Impossible de charger l'assistant.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const usable = useMemo(
    () =>
      PAGE_AGENTS.map((id) => agents.find((agent) => agent.id === id)).filter(
        (agent) => agent && agent.available !== false,
      ),
    [agents],
  );

  const active = usable.find((agent) => agent.id === activeId) ?? usable[0] ?? null;

  if (loading) return <PageLoading label="Chargement de l’assistant…" />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Mon espace"
        title="Assistant"
        subtitle="Une question sur qui fait quoi, sur votre parcours, vos formations, les procédures ou les compétences attendues ? L’assistant cherche dans les données que vous êtes autorisé à consulter, et cite ce qu’il a trouvé."
      />

      <div className="grid flex-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {usable.length === 0 ? (
            <EmptyState
              title="Aucun agent disponible"
              detail="Votre compte ne dispose des droits de lecture d’aucune des ressources que ces agents interrogent."
              muted
            />
          ) : (
            <motion.section
              variants={sectionVariants}
              initial={initialOrNone(reduce)}
              animate="visible"
            >
              <div className="mb-4 flex flex-wrap gap-2">
                {usable.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setActiveId(agent.id)}
                    className={cn(
                      'rounded-app border px-3 py-1.5 text-sm transition-colors',
                      agent.id === active?.id
                        ? 'border-red-brand bg-red-brand/10 font-medium text-red-brand'
                        : 'border-border text-text-dim hover:border-red-brand hover:text-red-brand',
                    )}
                  >
                    {agent.titleFr}
                  </button>
                ))}
              </div>

              {active && (
                <AssistantChat
                  key={active.id}
                  agentId={active.id}
                  titleFr={active.titleFr}
                  purposeFr={active.purposeFr}
                  provider={provider}
                  modelName={modelName}
                  suggestions={SUGGESTIONS[active.id] ?? []}
                  placeholder={PLACEHOLDERS[active.id] ?? 'Posez votre question…'}
                />
              )}
            </motion.section>
          )}
        </div>

        {/* Right column — where the recruit stands, so the assistant is not a page apart. */}
        <motion.aside
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.06 }}
          className="space-y-4"
        >
          <div className={`${CARD} p-5`}>
            <h2 className="mb-3 font-display text-lg text-text">Où j’en suis</h2>
            {overview ? (
              <ul className="space-y-2 text-sm">
                <Row label="Avancement du parcours" value={`${overview.progress.percent} %`} />
                <Row
                  label="Étapes en retard"
                  value={overview.overdueCount}
                  tone={overview.overdueCount > 0 ? 'red' : undefined}
                />
                <Row
                  label="Enquêtes à remplir"
                  value={overview.openSurveys}
                  tone={overview.openSurveys > 0 ? 'red' : undefined}
                />
                <Row
                  label="Modules à valider"
                  value={overview.trainingOutstanding}
                  tone={overview.trainingOutstanding > 0 ? 'red' : undefined}
                />
              </ul>
            ) : (
              <p className="text-sm text-text-dim">Aucun parcours d’intégration rattaché à votre compte.</p>
            )}
          </div>

          <div className={`${CARD} p-5`}>
            <h2 className="mb-2 font-display text-lg text-text">Les agents de la plateforme</h2>
            <ul className="space-y-3">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-text">{agent.titleFr}</span>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        agent.available !== false
                          ? 'bg-status-green/10 text-status-green'
                          : 'bg-surface-2 text-text-dim',
                      )}
                    >
                      {agent.available !== false ? 'Disponible' : 'Hors de vos droits'}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim">{agent.purposeFr}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-3">
              <ProviderNote provider={provider} modelName={modelName} />
              <p className="mt-2 text-xs text-text-dim">
                Un agent ne voit jamais plus que vous : il interroge les mêmes données, avec vos
                propres droits, et une réponse cite toujours sa source ou reconnaît n’avoir rien
                trouvé.
              </p>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}

function Row({ label, value, tone }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-text-dim">{label}</span>
      <span className={cn('font-medium', tone === 'red' ? 'text-status-red' : 'text-text')}>{value}</span>
    </li>
  );
}
