import { useEffect, useMemo, useState } from 'react';

import { assistantApi } from '../../api/assistant.js';
import AssistantChat, { ProviderNote } from '../../components/assistant/AssistantChat.jsx';
import { PageLoading, EmptyState } from '../../components/manager/PageStates.jsx';
import { cn } from '../../lib/cn.js';

/**
 * The generic, role-agnostic assistant page — every agent the caller is entitled to use,
 * on one page. Currently unrouted; it is the version to mount wherever a portal wants the
 * whole set rather than the curated subset the employee and manager pages offer.
 *
 * Which agents appear is the server's answer (`available`), derived from each agent's own
 * declared `reads` and this caller's permissions. Nothing here tests a role name.
 */
export default function AssistantPage() {
  const [agents, setAgents] = useState([]);
  const [provider, setProvider] = useState(null);
  const [modelName, setModelName] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    assistantApi
      .agents()
      .then((res) => {
        setAgents(res.data ?? []);
        setProvider(res.provider ?? null);
        setModelName(res.modelName ?? null);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  const usable = useMemo(() => agents.filter((agent) => agent.available !== false), [agents]);
  const active = usable.find((agent) => agent.id === activeId) ?? usable[0] ?? null;

  if (loading) return <PageLoading label="Chargement de l’assistant…" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-red-deep">Assistant</h1>
        <p className="mt-1 text-sm text-text-dim">
          Cinq agents, chacun limité aux ressources qu’il déclare lire. Chaque réponse est
          construite à partir des données que vous pouvez déjà consulter, et cite ses sources.
        </p>
        <p className="mt-2">
          <ProviderNote provider={provider} modelName={modelName} />
        </p>
      </div>

      {usable.length === 0 ? (
        <EmptyState
          title="Aucun agent disponible"
          detail="Votre compte ne dispose des droits de lecture d’aucune des ressources que ces agents interrogent."
          muted
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
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
            />
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-text">Les cinq agents</h2>
        <ul className="space-y-3">
          {agents.map((agent) => (
            <li key={agent.id} className="rounded-app border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">{agent.titleFr}</p>
                  <p className="mt-1 text-sm text-text-dim">{agent.purposeFr}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {agent.reads.map((resource) => (
                      <span
                        key={resource}
                        className="rounded-app bg-text-dim/10 px-2 py-0.5 text-[11px] text-text-dim"
                      >
                        {resource}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-app px-2 py-0.5 text-xs font-medium',
                    agent.available !== false
                      ? 'bg-green-600/10 text-green-700'
                      : 'bg-text-dim/10 text-text-dim',
                  )}
                >
                  {agent.available !== false ? 'Disponible' : 'Hors de vos droits'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-app border border-border bg-surface p-4">
        <p className="text-sm text-text-dim">
          Règle intangible, quel que soit l'agent : une réponse cite toujours sa source, ou
          reconnaît qu'elle n'a rien trouvé. Un agent lit avec les droits de la personne qui
          l'interroge — il ne peut jamais faire remonter une donnée que cette personne ne
          pourrait pas ouvrir elle-même. Les sources affichées proviennent toujours de la
          recherche, jamais du texte rédigé par le modèle.
        </p>
      </section>
    </div>
  );
}
