import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../../api/admin.js';
import { assistantApi } from '../../../api/assistant.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import Toggle from '../../../components/ui/Toggle.jsx';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /admin/ai (route guide §2.4, CORE).
 * "AI configuration: endpoints, model selection, quotas, per-agent enable/disable, prompt
 * templates."
 *
 * Every field on this page saves, and nothing reads what it saves. That is not an
 * oversight — ADR-003 keeps every business feature of this platform free of a dependency on
 * an external language model, and no provider is contracted. What is configured here is the
 * shape the feature will take the day one is: which agents are meant to be on, against which
 * endpoint and model, under what monthly quota, with which prompt.
 *
 * The page therefore states two things at once and keeps them visually apart:
 *   - the configuration, fully editable and durably stored;
 *   - the banner saying that nothing consumes it yet, and which agents work *without* a
 *     provider (those that answer by searching the platform's own data with the asker's own
 *     permissions).
 */
export default function AiConfigPage() {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState(null);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState(null);
  const [agents, setAgents] = useState([]);
  const [live, setLive] = useState({ provider: null, modelName: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ provider: '', endpoint: '', model: '', monthlyQuota: '' });
  const [prompts, setPrompts] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [openPrompt, setOpenPrompt] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const [configRes, statusRes, agentsRes] = await Promise.all([
        adminApi.aiConfig(),
        adminApi.ai().catch(() => null),
        assistantApi.agents().catch(() => ({ data: [] })),
      ]);

      setConfig(configRes.data);
      setMeta({ agents: configRes.agents ?? [], providerConnected: configRes.providerConnected, envVar: configRes.envVar });
      setStatus(statusRes);
      setAgents(agentsRes.data ?? []);
      // The *live* provider, read from the server's environment rather than from the saved
      // configuration below: the two can disagree, and when they do it is this one that is
      // actually answering questions.
      setLive({ provider: agentsRes.provider ?? null, modelName: agentsRes.modelName ?? null });
      setForm({
        provider: configRes.data.provider ?? '',
        endpoint: configRes.data.endpoint ?? '',
        model: configRes.data.model ?? '',
        monthlyQuota: configRes.data.monthlyQuota ?? '',
      });
      setPrompts(configRes.data.promptTemplates ?? {});
      setError(null);
    } catch {
      setError(t('admin.ai.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const enabled = config?.agentsEnabled ?? {};

  const stats = useMemo(() => {
    if (!config || !meta) return null;
    return {
      declared: meta.agents.length,
      // "Operational" means answerable without a provider: an agent that retrieves from the
      // platform's own data. That is a different claim from "enabled", and conflating them
      // would let the page report five working agents on an empty configuration.
      operational: agents.filter((agent) => agent.live).length,
      enabled: meta.agents.filter((id) => enabled[id]).length,
      prompts: Object.values(config.promptTemplates ?? {}).filter((value) => value && value.trim()).length,
    };
  }, [config, meta, agents, enabled]);

  async function patch(payload, successText) {
    setSaving(true);
    setNotice(null);
    try {
      await adminApi.updateAiConfig(payload);
      await load();
      setNotice({ tone: 'ok', text: successText });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? t('admin.ai.saveFailed') });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProvider(event) {
    event.preventDefault();
    await patch(
      {
        provider: form.provider.trim() || null,
        endpoint: form.endpoint.trim() || null,
        model: form.model.trim() || null,
        monthlyQuota: form.monthlyQuota === '' ? null : Number(form.monthlyQuota),
      },
      t('admin.ai.providerSaved'),
    );
  }

  async function handleToggleAgent(agentId) {
    await patch(
      { agentsEnabled: { [agentId]: !enabled[agentId] } },
      enabled[agentId] ? t('admin.ai.agentDisabled') : t('admin.ai.agentEnabled'),
    );
  }

  async function handleSavePrompt(agentId) {
    await patch({ promptTemplates: { [agentId]: prompts[agentId] ?? '' } }, t('admin.ai.promptSaved'));
    setOpenPrompt(null);
  }

  if (loading) return <PageLoading label={t('admin.ai.loading')} />;
  if (error) return <PageError message={error} />;

  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('admin.ai.eyebrow')}
        title={t('admin.ai.title')}
        subtitle={t('admin.ai.subtitle')}
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label={t('admin.ai.tiles.declared')} value={stats.declared} />
        <Tile label={t('admin.ai.tiles.enabled')} value={stats.enabled} />
        <Tile label={t('admin.ai.tiles.operational')} value={stats.operational} />
        <Tile label={t('admin.ai.tiles.prompts')} value={stats.prompts} />
      </motion.div>

      {/* The banner that must never be missed — driven by the live environment, not the form. */}
      <div
        className={`mb-6 rounded-app border p-4 ${
          live.provider
            ? 'border-status-green/30 bg-status-green/5'
            : 'border-red-brand/40 bg-red-brand/5'
        }`}
      >
        <p className="text-sm font-medium text-text">
          {live.provider
            ? live.modelName
              ? `${t('admin.ai.banner.connectedWithModel', { provider: live.provider, model: live.modelName })}.`
              : `${t('admin.ai.banner.connected', { provider: live.provider })}.`
            : t('admin.ai.banner.none')}
        </p>
        <p className="mt-1 text-sm text-text-dim">
          {live.provider ? t('admin.ai.banner.connectedNote') : t('admin.ai.banner.noneNote')}
        </p>
        <p className="mt-2 font-mono text-[11px] text-text-dim">
          {live.provider ? 'HF_API_KEY, HF_MODEL, HF_BASE_URL' : meta.envVar}
        </p>
      </div>

      <AnimatePresence initial={false}>
        {notice && (
          <motion.p
            key={notice.text}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mb-4 overflow-hidden rounded-app border p-3 text-sm ${
              notice.tone === 'warn'
                ? 'border-status-red/30 bg-status-red/5 text-status-red'
                : 'border-status-green/30 bg-status-green/5 text-status-green'
            }`}
          >
            {notice.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Provider / model / quota */}
      <form onSubmit={handleSaveProvider} className={`${CARD} mb-8 space-y-4 p-6`}>
        <h2 className="font-display text-lg text-text">{t('admin.ai.form.title')}</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Labelled label={t('admin.ai.form.provider')} hint={t('admin.ai.form.providerHint')}>
            <input
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              placeholder={t('admin.ai.form.providerPlaceholder')}
              className={FIELD}
            />
          </Labelled>
          <Labelled label={t('admin.ai.form.endpoint')}>
            <input
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              placeholder="https://…"
              className={FIELD}
            />
          </Labelled>
          <Labelled label={t('admin.ai.form.model')}>
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className={FIELD}
            />
          </Labelled>
          <Labelled label={t('admin.ai.form.monthlyQuota')} hint={t('admin.ai.form.monthlyQuotaHint')}>
            <input
              type="number"
              min={0}
              value={form.monthlyQuota}
              onChange={(e) => setForm((f) => ({ ...f, monthlyQuota: e.target.value }))}
              className={FIELD}
            />
          </Labelled>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-text-dim">
            {config.updatedAt
              ? t('admin.ai.form.lastModified', { date: new Date(config.updatedAt).toLocaleString(localeOf(i18n)) })
              : t('admin.ai.form.neverSaved')}
          </p>
          <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
            {saving ? t('admin.ai.form.saving') : t('common.actions.save')}
          </button>
        </div>
      </form>

      {/* Agents */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-xl text-text">{t('admin.ai.agents.title')}</h2>
        <p className="mb-4 text-sm text-text-dim">{t('admin.ai.agents.description')}</p>

        {meta.agents.length === 0 ? (
          <EmptyState muted title={t('admin.ai.agents.empty')} detail={t('admin.ai.agents.emptyDetail')} />
        ) : (
          <motion.div
            variants={staggerContainer(0.05)}
            initial={initialOrNone(reduce)}
            animate="visible"
            className="space-y-3"
          >
            {meta.agents.map((agentId) => {
              const agent = agentById.get(agentId);
              const on = Boolean(enabled[agentId]);
              const promptOpen = openPrompt === agentId;
              const promptValue = prompts[agentId] ?? '';

              return (
                <motion.article key={agentId} variants={staggerItem} className={`${CARD} p-5`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-text">{agent?.titleFr ?? agentId}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            agent?.live
                              ? 'bg-status-green/10 text-status-green'
                              : 'bg-surface-2 text-text-dim'
                          }`}
                        >
                          {agent?.live
                            ? live.provider
                              ? t('admin.ai.agents.operationalReformulated')
                              : t('admin.ai.agents.operationalNoLlm')
                            : t('admin.ai.agents.noAnswerStep')}
                        </span>
                      </div>
                      {agent?.purposeFr && <p className="mt-1 text-sm text-text-dim">{agent.purposeFr}</p>}
                      {agent?.reads?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {agent.reads.map((resource) => (
                            <span
                              key={resource}
                              className="rounded-app bg-surface-2 px-2 py-0.5 text-[11px] text-text-dim"
                            >
                              {resource}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Toggle
                        size="lg"
                        checked={on}
                        disabled={saving}
                        onChange={() => handleToggleAgent(agentId)}
                        label={t('admin.ai.agents.toggleLabel', { name: agent?.titleFr ?? agentId })}
                      />
                      <button
                        type="button"
                        onClick={() => setOpenPrompt(promptOpen ? null : agentId)}
                        className="text-xs text-red-brand hover:underline"
                      >
                        {promptOpen
                          ? t('admin.ai.agents.closePrompt')
                          : promptValue
                            ? t('admin.ai.agents.editPrompt')
                            : t('admin.ai.agents.definePrompt')}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {promptOpen && (
                      <motion.div
                        initial={reduce ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 border-t border-border pt-4">
                          <label className="mb-1 block text-sm font-medium text-text">
                            {t('admin.ai.agents.promptLabel')}
                          </label>
                          <textarea
                            rows={4}
                            value={promptValue}
                            onChange={(e) => setPrompts((current) => ({ ...current, [agentId]: e.target.value }))}
                            placeholder={t('admin.ai.agents.promptPlaceholder')}
                            className={FIELD}
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button type="button" onClick={() => setOpenPrompt(null)} className={SECONDARY_BUTTON}>
                              {t('common.actions.cancel')}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleSavePrompt(agentId)}
                              className={PRIMARY_BUTTON}
                            >
                              {t('admin.ai.agents.savePrompt')}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </motion.div>
        )}
      </section>

      <p className="rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        {t('admin.ai.footnote', {
          count: status?.agentsOperational ?? stats.operational,
          tail: live.provider ? t('admin.ai.footnoteTailConnected') : t('admin.ai.footnoteTailNone'),
        })}
      </p>
    </div>
  );
}

const PRIMARY_BUTTON =
  'rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60';
const SECONDARY_BUTTON =
  'rounded-app border border-border px-3 py-2 text-sm font-medium text-text-dim transition-colors hover:bg-surface-2';

function Labelled({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <motion.div variants={staggerItem} className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className="font-display text-3xl text-red-deep">
        <CountUp value={value} />
      </p>
    </motion.div>
  );
}
