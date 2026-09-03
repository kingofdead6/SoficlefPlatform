import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t } = useTranslation();

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

  if (loading) return <PageLoading label={t('assistant.loading')} />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-red-deep">{t('assistant.generic.title')}</h1>
        <p className="mt-1 text-sm text-text-dim">{t('assistant.generic.intro')}</p>
        <p className="mt-2">
          <ProviderNote provider={provider} modelName={modelName} />
        </p>
      </div>

      {usable.length === 0 ? (
        <EmptyState title={t('assistant.empty.title')} detail={t('assistant.empty.detail')} muted />
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
        <h2 className="mb-2 text-sm font-medium text-text">{t('assistant.generic.agentsTitle')}</h2>
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
                  {agent.available !== false
                    ? t('assistant.agents.available')
                    : t('assistant.agents.unavailable')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-app border border-border bg-surface p-4">
        <p className="text-sm text-text-dim">{t('assistant.generic.rule')}</p>
      </section>
    </div>
  );
}
