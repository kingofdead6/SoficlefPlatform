import { useEffect, useState } from 'react';

import { assistantApi } from '../../api/assistant.js';

/**
 * The five assistants of CDC-2026 §4 (ADR-003: no LLM provider is called anywhere in
 * this platform). Agent 1 ("orientation") is the only one with a real answer path —
 * retrieval and ranking over the asker's own visible data, not generation. The other
 * four are declared, with what they would read and the citation rule that any future
 * generation step must respect, but produce no answer yet.
 *
 * This page is deliberately honest about that boundary rather than simulating a chat
 * experience the platform does not provide.
 */
export default function AssistantPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    assistantApi
      .agents()
      .then(({ data }) => setAgents(data ?? []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const ask = async (event) => {
    event.preventDefault();
    if (question.trim().length < 2) return;
    setAsking(true);
    setAnswer(null);
    try {
      const result = await assistantApi.askOrientation(question.trim());
      setAnswer(result);
    } catch {
      setAnswer({ agent: 'orientation', answer: null, sources: [] });
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-red-deep">Assistant</h1>
        <p className="text-text-dim mt-1 text-sm">
          Aucun fournisseur de modèle de langage n'est raccordé à la plateforme (décision
          d'architecture, pas un manque provisoire). L'agent d'accueil ci-dessous répond
          par recherche dans les données que vous pouvez déjà consulter — les quatre
          autres sont décrits mais ne répondent pas encore.
        </p>
      </div>

      <section className="rounded-app border border-border bg-surface p-4 space-y-4">
        <h2 className="text-sm font-medium text-text">Agent 1 · À qui m'adresser ?</h2>
        <form onSubmit={ask} className="flex flex-wrap gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex. À qui m'adresser pour les congés ?"
            minLength={2}
            maxLength={300}
            className="rounded-app border border-border min-w-[240px] flex-1 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={asking}
            className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
          >
            {asking ? 'Recherche…' : 'Demander'}
          </button>
        </form>

        {answer && (
          <div className="border-border rounded-app border bg-bg p-3 text-sm">
            {answer.answer ? (
              <>
                <p className="text-text whitespace-pre-line">{answer.answer}</p>
                {answer.sources.length > 0 && (
                  <ul className="text-text-dim mt-2 space-y-1 text-xs">
                    {answer.sources.map((source) => (
                      <li key={`${source.kind}-${source.id}`}>
                        Source : {source.label}
                        {source.href && (
                          <a href={source.href} className="text-red-strong ml-1">
                            (voir)
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-text-dim">
                Aucune réponse trouvée. L'assistant ne devine jamais : il préfère dire
                qu'il n'a rien trouvé plutôt que d'avancer une réponse invérifiable.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-text">Les cinq agents</h2>
        {loading ? (
          <p className="text-text-dim text-sm">Chargement…</p>
        ) : (
          <ul className="space-y-3">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="rounded-app border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-text text-sm font-medium">{agent.titleFr}</p>
                    <p className="text-text-dim mt-1 text-sm">{agent.purposeFr}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {agent.reads.map((resource) => (
                        <span
                          key={resource}
                          className="bg-text-dim/10 text-text-dim rounded-app px-2 py-0.5 text-[11px]"
                        >
                          {resource}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-app px-2 py-0.5 text-xs font-medium ${
                      agent.live ? 'bg-green-600/10 text-green-700' : 'bg-text-dim/10 text-text-dim'
                    }`}
                  >
                    {agent.live ? 'Opérationnel' : 'En attente du fournisseur'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-app border border-border bg-surface p-4">
        <p className="text-text-dim text-sm">
          Règle intangible, quel que soit l'agent : une réponse cite toujours sa source, ou
          reconnaît qu'elle n'a rien trouvé. Un agent lit avec les droits de la personne qui
          l'interroge — il ne peut jamais faire remonter une donnée que cette personne ne
          pourrait pas ouvrir elle-même.
        </p>
      </section>
    </div>
  );
}
