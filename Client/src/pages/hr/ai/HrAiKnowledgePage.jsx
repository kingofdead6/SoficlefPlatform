import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import { assistantApi } from '../../../api/assistant.js';
import { documentsApi } from '../../../api/documents.js';
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
 * **The second honest page.** GET /assistant/agents returns the real structure — the five
 * agents, what each is permitted to read, and which one has an implemented answering step —
 * and that structure is what this page shows, faithfully.
 *
 * The three other things the spec asks for do not exist and are not simulated:
 *  - "test a question": only Agent 1 (orientation) answers, and it does so by *retrieval*
 *    over the caller's visible org tree, not by generation. That one live path is offered
 *    here as what it actually is — a directory lookup — and the four other agents are marked
 *    unavailable rather than given a chat box that returns nothing.
 *  - "re-index": there is no vector index. Retrieval reads the database directly with the
 *    asker's own permissions, so there is nothing to rebuild.
 *  - "flagged answers": nothing generates answers, so no answer has ever been flagged, and
 *    no `flagged_answer` table exists.
 *
 * The design principle behind all three: an agent never sees a row its asker could not have
 * opened themselves, because retrieval runs under the asker's own scope. That is stated on
 * the page, because it is the part of the feature that *is* built.
 */
export default function HrAiKnowledgePage() {
  const [agents, setAgents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [agentsRes, documentsRes] = await Promise.all([
          assistantApi.agents(),
          documentsApi.list().catch(() => ({ data: [] })),
        ]);
        setAgents(agentsRes.data);
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

  async function handleAsk(event) {
    event.preventDefault();
    if (question.trim().length < 2) return;
    setAsking(true);
    setAnswer(null);
    try {
      const result = await assistantApi.askOrientation(question.trim());
      setAnswer(result);
    } catch {
      setAnswer({ answer: null, sources: [], failed: true });
    } finally {
      setAsking(false);
    }
  }

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
                    agent.live
                      ? 'bg-status-green/10 text-status-green'
                      : 'bg-surface-2 text-text-dim'
                  }`}
                >
                  {agent.live ? 'Opérationnel' : 'Non disponible'}
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
          Un seul agent répond aujourd’hui : l’agent d’orientation, et il le fait par recherche dans
          l’organigramme visible, pas par génération de texte. Les quatre autres n’ont pas d’étape de
          réponse implémentée — aucun fournisseur de modèle de langage n’est raccordé à cette
          plateforme (décision d’architecture ADR-003). Aucune interface de conversation n’est donc
          proposée pour eux : elle ne produirait rien de réel.
        </p>

        <form onSubmit={handleAsk} className={`${CARD} space-y-3 p-5`}>
          <label className="block text-sm font-medium text-text">
            Question d’orientation — « à qui m’adresser pour… »
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Qui s’occupe de la qualité ?"
              maxLength={300}
              className="min-w-[240px] flex-1 rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand"
            />
            <button
              type="submit"
              disabled={asking || question.trim().length < 2}
              className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-50"
            >
              {asking ? 'Recherche…' : 'Rechercher'}
            </button>
          </div>

          {answer && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-t border-border pt-3"
            >
              {answer.failed ? (
                <p className="text-sm text-status-red">La recherche a échoué.</p>
              ) : answer.answer === null ? (
                <EmptyState
                  title="Aucune réponse trouvée"
                  detail="Rien dans votre organigramme visible ne correspond à cette question. L’agent ne devine pas : une réponse sans source n’est pas une réponse."
                  muted
                />
              ) : (
                <>
                  <p className="text-sm text-text">{answer.answer}</p>
                  {answer.sources?.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                        Sources
                      </p>
                      <ul className="space-y-1">
                        {answer.sources.map((source, index) => (
                          <li key={index} className="text-xs text-text-dim">
                            {source.labelFr ?? source.label ?? JSON.stringify(source)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </form>
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
          detail="Aucune réponse n’est générée, donc aucune n’a jamais pu être signalée : la plateforme ne comporte ni file de signalements ni historique de réponses. Cette revue prendra son sens le jour où une étape de génération existera."
          muted
        />
      </motion.section>

      <section>
        <h2 className="mb-1 font-display text-xl text-text">Documents accessibles à l’agent 2</h2>
        <p className="mb-4 text-sm text-text-dim">
          Les documents publiés que l’agent documentaire pourra consulter le jour où son étape de
          réponse existera. Ce sont exactement ceux de la bibliothèque, sans copie ni index séparé.
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
