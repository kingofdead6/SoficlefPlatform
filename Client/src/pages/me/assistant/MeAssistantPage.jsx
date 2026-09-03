import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

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

/**
 * Openers per agent, showing what each can really answer rather than inviting free chat.
 * Held as catalogue keys, resolved inside the component so they follow a language switch.
 */
const SUGGESTION_KEYS = {
  orientation: ['orientation1', 'orientation2', 'orientation3'],
  onboarding: ['onboarding1', 'onboarding2', 'onboarding3'],
  training: ['training1', 'training2', 'training3'],
  documents: ['documents1', 'documents2', 'documents3'],
  competencies: ['competencies1', 'competencies2'],
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
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t } = useTranslation();

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
        setError('load');
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

  if (loading) return <PageLoading label={t('assistant.loading')} />;
  if (error) return <PageError message={t('assistant.loadFailed')} />;

  const suggestions = (SUGGESTION_KEYS[active?.id] ?? []).map((key) =>
    t(`me.assistant.suggestions.${key}`),
  );
  const placeholder = active?.id
    ? t(`me.assistant.placeholders.${active.id}`, { defaultValue: t('me.assistant.placeholders.default') })
    : t('me.assistant.placeholders.default');

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.assistant.title')}
        subtitle={t('me.assistant.subtitle')}
      />

      <div className="grid flex-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {usable.length === 0 ? (
            <EmptyState title={t('assistant.empty.title')} detail={t('assistant.empty.detail')} muted />
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
                  suggestions={suggestions}
                  placeholder={placeholder}
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
            <h2 className="mb-3 font-display text-lg text-text">{t('me.assistant.status.title')}</h2>
            {overview ? (
              <ul className="space-y-2 text-sm">
                <Row label={t('me.assistant.status.progress')} value={`${overview.progress.percent} %`} />
                <Row
                  label={t('me.assistant.status.overdue')}
                  value={overview.overdueCount}
                  tone={overview.overdueCount > 0 ? 'red' : undefined}
                />
                <Row
                  label={t('me.assistant.status.openSurveys')}
                  value={overview.openSurveys}
                  tone={overview.openSurveys > 0 ? 'red' : undefined}
                />
                <Row
                  label={t('me.assistant.status.trainingOutstanding')}
                  value={overview.trainingOutstanding}
                  tone={overview.trainingOutstanding > 0 ? 'red' : undefined}
                />
              </ul>
            ) : (
              <p className="text-sm text-text-dim">{t('me.assistant.noJourney')}</p>
            )}
          </div>

          <div className={`${CARD} p-5`}>
            <h2 className="mb-2 font-display text-lg text-text">{t('me.assistant.agentsTitle')}</h2>
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
                      {agent.available !== false
                        ? t('assistant.agents.available')
                        : t('assistant.agents.unavailable')}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim">{agent.purposeFr}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-border pt-3">
              <ProviderNote provider={provider} modelName={modelName} />
              <p className="mt-2 text-xs text-text-dim">{t('me.assistant.rights')}</p>
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
