import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { assistantApi } from '../../../api/assistant.js';
import { documentsApi } from '../../../api/documents.js';
import AssistantChat, { ProviderNote } from '../../../components/assistant/AssistantChat.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/** The platform resources an agent may read, in French. */
const RESOURCE_LABELS = {
  position: 'Postes',
  assignment: 'Affectations',
  organization_unit: 'Structures',
  document: 'Bibliothèque documentaire',
  onboarding_instance: 'Parcours d’intégration',
  onboarding_task: 'Étapes de parcours',
  training: 'Catalogue de formation',
  competency: 'Référentiel de compétences',
  job_description: 'Fiches de poste',
};

/**
 * /app/hr/ai-knowledge (route guide §2.3, CORE).
 * "Which documents feed each agent, re-index, test a question, review flagged answers."
 *
 * GET /assistant/agents returns the real structure — the five agents, what each is permitted
 * to read, and what is currently answering — and that structure is what this page shows.
 *
 * "Test a question" is now real for all five agents, against the *signed-in HR user's own*
 * scope: that is the honest thing for a test bench to do, since an answer rendered under
 * someone else's permissions would tell HR nothing about what a recruit will actually see.
 *
 * Two of the spec's asks still do not exist, and are not simulated:
 *  - "re-index": there is no vector index. Retrieval reads the database directly with the
 *    asker's own permissions, so there is nothing to rebuild.
 *  - "flagged answers": no answer history is stored, so none has ever been flagged, and no
 *    `flagged_answer` table exists.
 *
 * The design principle behind all of it: an agent never sees a row its asker could not have
 * opened themselves, because retrieval runs under the asker's own scope — and the language
 * model, when one is configured, only rephrases what retrieval already fetched.
 */
export default function HrAiKnowledgePage() {
  const [agents, setAgents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const [modelName, setModelName] = useState(null);
  const [testAgentId, setTestAgentId] = useState('orientation');
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [agentsRes, documentsRes] = await Promise.all([
          assistantApi.agents(),
          documentsApi.list().catch(() => ({ data: [] })),
        ]);
        setAgents(agentsRes.data);
        setProvider(agentsRes.provider ?? null);
        setModelName(agentsRes.modelName ?? null);
        setDocuments(documentsRes.data ?? []);
      } catch {
        setError('Impossible de charger la configuration des agents.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const published = useMemo(
    () => documents.filter((doc) => doc.availability === 'AVAILABLE'),
    [documents],
  );

  const liveAgents = agents.filter((agent) => agent.live);
  const testableAgents = agents.filter((agent) => agent.available !== false);
  const testAgent =
    testableAgents.find((agent) => agent.id === testAgentId) ?? testableAgents[0] ?? null;

  if (loading) return <PageLoading label="Chargement des agents…" />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Base de connaissances des agents"
        subtitle="Ce que chaque agent est autorisé à lire, et l’état réel de la fonctionnalité."
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-3"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Agents définis
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={agents.length} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Agents opérationnels
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={liveAgents.length} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Documents publiés
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={published.length} />
          </p>
        </motion.div>
      </motion.div>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10"
      >
        <h2 className="mb-1 font-display text-xl text-text">Sources de chaque agent</h2>
        <p className="mb-4 text-sm text-text-dim">
          Les sources ne sont pas des fichiers indexés mais des ressources de la plateforme, lues
          avec les permissions et le périmètre de la personne qui pose la question. Un agent ne peut
          donc jamais faire apparaître une ligne que son interlocuteur n’aurait pas pu ouvrir
          lui-même.
        </p>

        <motion.div
          variants={staggerContainer(0.05)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="grid gap-4 sm:grid-cols-2"
        >
          {agents.map((agent) => (
            <motion.div key={agent.id} variants={staggerItem} className={`${CARD} p-5`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg text-text">{agent.titleFr}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    agent.available !== false
                      ? 'bg-status-green/10 text-status-green'
                      : 'bg-surface-2 text-text-dim'
                  }`}
                >
                  {agent.available !== false ? 'Opérationnel' : 'Hors de vos droits'}
                </span>
              </div>
              <p className="mt-1 text-sm text-text-dim">{agent.purposeFr}</p>

              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                  Lit
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.reads.map((resource) => (
                    <span
                      key={resource}
                      className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs text-red-brand"
                    >
                      {RESOURCE_LABELS[resource] ?? resource}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.06 }}
        className="mb-10"
      >
        <h2 className="mb-1 font-display text-xl text-text">Tester une question</h2>
        <p className="mb-4 text-sm text-text-dim">
          Les cinq agents répondent. Chacun cherche d’abord dans les données de la plateforme, avec
          les droits de la personne qui pose la question — ici, les vôtres. Ce que vous voyez
          ci-dessous est donc le comportement réel de l’agent <em>pour votre compte</em> : une
          recrue interrogeant le même agent obtiendra les résultats de <em>son</em> périmètre, qui
          peuvent être différents.
        </p>
        <p className="mb-4 text-sm text-text-dim">
          <ProviderNote provider={provider} modelName={modelName} />
        </p>

        {testableAgents.length === 0 ? (
          <EmptyState
            title="Aucun agent interrogeable"
            detail="Votre compte ne dispose des droits de lecture d’aucune des ressources lues par ces agents."
            muted
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {testableAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setTestAgentId(agent.id)}
                  className={`rounded-app border px-3 py-1.5 text-sm transition-colors ${
                    agent.id === testAgent?.id
                      ? 'border-red-brand bg-red-brand/10 font-medium text-red-brand'
                      : 'border-border text-text-dim hover:border-red-brand hover:text-red-brand'
                  }`}
                >
                  {agent.titleFr}
                </button>
              ))}
            </div>

            {testAgent && (
              <AssistantChat
                key={testAgent.id}
                agentId={testAgent.id}
                purposeFr={testAgent.purposeFr}
                provider={provider}
                modelName={modelName}
                emptyDetailFr="Posez une question pour observer ce que l’agent renvoie, et depuis quelles sources."
              />
            )}
          </>
        )}
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.12 }}
        className="mb-10"
      >
        <h2 className="mb-1 font-display text-xl text-text">Réindexation</h2>
        <EmptyState
          title="Sans objet"
          detail="Il n’y a pas d’index à reconstruire : la recherche interroge directement la base, à chaque question, avec les permissions de la personne qui demande. C’est ce qui garantit qu’un agent ne peut pas conserver, dans un index périmé, une donnée à laquelle son interlocuteur n’a plus accès."
          muted
        />
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.18 }}
        className="mb-10"
      >
        <h2 className="mb-1 font-display text-xl text-text">Réponses signalées</h2>
        <EmptyState
          title="Non disponible"
          detail="Aucun historique de réponses n’est conservé — ni file de signalements, ni table de réponses. Une réponse n’existe que le temps de la question qui l’a produite, ce qui évite de stocker en clair des extraits d’évaluations ou de parcours, mais rend impossible toute revue a posteriori."
          muted
        />
      </motion.section>

      <section>
        <h2 className="mb-1 font-display text-xl text-text">Documents accessibles à l’agent 2</h2>
        <p className="mb-4 text-sm text-text-dim">
          Les documents publiés que l’agent documentaire consulte. Ce sont exactement ceux de la
          bibliothèque, sans copie ni index séparé — et il applique la même règle d’audience :
          un document réservé à certains départements reste invisible pour les autres, dans
          l’assistant comme dans la bibliothèque.
        </p>
        {published.length === 0 ? (
          <EmptyState detail="Aucun document publié dans la bibliothèque." muted />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Fichier</th>
                </tr>
              </thead>
              <tbody>
                {published.map((doc) => (
                  <tr key={doc.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text">{doc.titleFr}</td>
                    <td className="px-4 py-3 font-mono text-xs text-text-dim">{doc.slug}</td>
                    <td className="px-4 py-3 text-xs text-text-dim">
                      {doc.fileName ?? 'Aucun fichier joint'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link
          to="/app/hr/documents"
          className="mt-3 inline-block text-sm text-red-brand hover:underline"
        >
          Gérer la bibliothèque documentaire →
        </Link>
      </section>
    </div>
  );
}
