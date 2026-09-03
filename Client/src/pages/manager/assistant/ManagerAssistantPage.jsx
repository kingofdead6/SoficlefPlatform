import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { assistantApi } from '../../../api/assistant.js';
import { onboardingApi } from '../../../api/onboarding.js';
import AssistantChat, { ProviderNote } from '../../../components/assistant/AssistantChat.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';

/**
 * /app/manager/assistant (route guide §2.2, CORE).
 *
 * Two halves, and they answer different kinds of question:
 *
 *   - the assistant, which answers from what this manager may read — orientation and
 *     onboarding, plus documents and competencies, which every account type gets;
 *   - the alerts, which are structured facts already computed by domain/manager/alerts.js
 *     from this manager's own recruits. Those stay: "what is blocking X" is answered better
 *     by a computed list than by a sentence, and it always was.
 *
 * One boundary worth stating plainly on the page: the onboarding agent answers about the
 * *asker's own* journey, never a recruit's. Choosing a subject is an explicit act that
 * belongs on the recruit pages, where the perimeter check is visible; an assistant is not
 * the place to make that choice implicitly. A manager's view of a recruit's journey is the
 * "Qu'est-ce qui bloque ?" list below and the recruit's own page.
 */

/** Suggestion chips, three per agent at most — resolved through i18n at render time. */
const SUGGESTION_KEYS = {
  orientation: [
    'managerAssistant.suggestions.orientation.1',
    'managerAssistant.suggestions.orientation.2',
    'managerAssistant.suggestions.orientation.3',
  ],
  onboarding: [
    'managerAssistant.suggestions.onboarding.1',
    'managerAssistant.suggestions.onboarding.2',
  ],
  documents: [
    'managerAssistant.suggestions.documents.1',
    'managerAssistant.suggestions.documents.2',
  ],
  competencies: [
    'managerAssistant.suggestions.competencies.1',
    'managerAssistant.suggestions.competencies.2',
  ],
};

const PLACEHOLDER_KEYS = {
  orientation: 'managerAssistant.placeholders.orientation',
  onboarding: 'managerAssistant.placeholders.onboarding',
  documents: 'managerAssistant.placeholders.documents',
  competencies: 'managerAssistant.placeholders.competencies',
};

/** The agents this page offers, in the order a manager reaches for them. */
const PAGE_AGENTS = ['orientation', 'onboarding', 'documents', 'competencies'];

export default function ManagerAssistantPage() {
  const { t } = useTranslation();
  const [recruits, setRecruits] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [provider, setProvider] = useState(null);
  const [modelName, setModelName] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const [recruitsRes, agentsRes] = await Promise.all([
          onboardingApi.managerRecruits(false),
          assistantApi.agents().catch(() => ({ data: [] })),
        ]);
        setRecruits(recruitsRes.data);
        setAlerts(recruitsRes.alerts);
        setAgents(agentsRes.data ?? []);
        setProvider(agentsRes.provider ?? null);
        setModelName(agentsRes.modelName ?? null);
      } catch {
        setError(t('managerAssistant.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const usable = useMemo(
    () =>
      PAGE_AGENTS.map((id) => agents.find((agent) => agent.id === id)).filter(
        (agent) => agent && agent.available !== false,
      ),
    [agents],
  );

  const active = usable.find((agent) => agent.id === activeId) ?? usable[0] ?? null;

  if (loading) return <PageLoading label={t('managerAssistant.loading')} />;
  if (error) return <PageError message={error} />;

  const reminders = alerts.filter((a) => a.kind === 'evaluation');
  const blockers = alerts.filter((a) => a.kind === 'blocked' || a.kind === 'overdue');

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('managerAssistant.title')}
        subtitle={t('managerAssistant.subtitle')}
      />

      <div className="space-y-8">
        <motion.section variants={sectionVariants} initial={initialOrNone(reduce)} animate="visible">
          {usable.length === 0 ? (
            <EmptyState
              title={t('managerAssistant.noAgentsTitle')}
              detail={t('managerAssistant.noAgentsDetail')}
              muted
            />
          ) : (
            <>
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
                  suggestions={(SUGGESTION_KEYS[active.id] ?? []).map((key) => t(key))}
                  placeholder={
                    PLACEHOLDER_KEYS[active.id]
                      ? t(PLACEHOLDER_KEYS[active.id])
                      : t('managerAssistant.placeholders.fallback')
                  }
                />
              )}

              {active?.id === 'onboarding' && (
                <p className="mt-3 text-xs text-text-dim">{t('managerAssistant.ownJourneyNotice')}</p>
              )}
            </>
          )}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.08 }}
        >
          <h2 className="mb-3 font-display text-lg text-text">{t('managerAssistant.remindersTitle')}</h2>
          <motion.div variants={staggerContainer(0.06)} initial={initialOrNone(reduce)} animate="visible" className="space-y-2">
            {reminders.map((alert) => (
              <motion.div key={alert.id} variants={staggerItem}>
                <Link
                  to={alert.href}
                  className="block rounded-app border border-border bg-surface p-3 text-sm shadow-app transition hover:border-red-brand hover:shadow-app-lifted"
                >
                  <p className="font-medium text-text">{alert.titleFr}</p>
                  <p className="text-xs text-text-dim">{alert.detailFr}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          {reminders.length === 0 && <EmptyState detail={t('managerAssistant.noReminders')} muted />}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.16 }}
        >
          <h2 className="mb-3 font-display text-lg text-text">{t('managerAssistant.blockersTitle')}</h2>
          <motion.div variants={staggerContainer(0.06)} initial={initialOrNone(reduce)} animate="visible" className="space-y-2">
            {blockers.map((alert) => (
              <motion.div key={alert.id} variants={staggerItem}>
                <Link
                  to={alert.href}
                  className="block rounded-app border border-status-red/40 bg-status-red/10 p-3 text-sm text-status-red shadow-app transition hover:shadow-app-lifted"
                >
                  <p className="font-medium">{alert.titleFr}</p>
                  <p className="text-xs opacity-80">{alert.detailFr}</p>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          {blockers.length === 0 && <EmptyState detail={t('managerAssistant.noBlockers')} muted />}
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.24 }}
        >
          <h2 className="mb-3 font-display text-lg text-text">{t('managerAssistant.prepareTitle')}</h2>
          <EmptyState
            title={t('managerAssistant.noDraftingTitle')}
            detail={t('managerAssistant.noDraftingDetail')}
            muted
          />
          {recruits.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recruits.map((recruit) => (
                <Link
                  key={recruit.userId}
                  to={`/app/manager/interviews/${recruit.userId}`}
                  className="rounded-app border border-border px-2 py-1 text-xs font-medium text-red-brand transition hover:bg-surface-2"
                >
                  {recruit.displayName}
                </Link>
              ))}
            </div>
          )}
        </motion.section>

        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <ProviderNote provider={provider} modelName={modelName} />
        </div>
      </div>
    </div>
  );
}
