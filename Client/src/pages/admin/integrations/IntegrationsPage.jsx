import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../../api/admin.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import Toggle from '../../../components/ui/Toggle.jsx';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const MODE_PILL = {
  PRODUCTION: 'bg-status-green/10 text-status-green',
  MOCK: 'bg-red-brand/10 text-red-brand',
};

/**
 * Which config fields each connector offers. Deliberately a small, explicit map rather than
 * a free-form JSON editor: an administrator setting up SMTP should see "host" and "port",
 * not be asked to hand-write a JSON object whose keys nobody validates. A connector absent
 * from this map is still listed and switchable — it simply has no fields yet. Field labels
 * live under admin.integrations.fields.* in the catalogues.
 */
const CONFIG_FIELDS = {
  smtp: [
    { key: 'host', labelKey: 'smtp.host', placeholder: 'smtp.soficlef.dz' },
    { key: 'port', labelKey: 'smtp.port', placeholder: '587' },
    { key: 'from', labelKey: 'smtp.from', placeholder: 'no-reply@soficlef.dz' },
  ],
  entra: [
    { key: 'tenantId', labelKey: 'entra.tenantId', placeholderKey: 'entra.tenantIdPlaceholder' },
    { key: 'clientId', labelKey: 'entra.clientId', placeholder: '' },
  ],
  hrApi: [{ key: 'baseUrl', labelKey: 'hrApi.baseUrl', placeholder: 'https://sirh.example/api' }],
  directory: [{ key: 'path', labelKey: 'directory.path', placeholder: '\\\\serveur\\partage' }],
  storage: [{ key: 'driver', labelKey: 'storage.driver', placeholder: 's3 | local' }],
  ai: [
    { key: 'endpoint', labelKey: 'ai.endpoint', placeholder: 'https://…' },
    { key: 'model', labelKey: 'ai.model', placeholder: '' },
  ],
};

/**
 * /admin/integrations (route guide §2.4, CHAIN/LATER).
 * "Entra ID/AD, HR API connectors, shared directories, SMTP; per-connector Mock ↔ Production
 * toggle with test-connection — the literal Plug & Play switch."
 *
 * The switch is real: flipping a connector writes to the `connector` table through the
 * platform's audited mutation pipeline. What the switch cannot do is conjure a system on the
 * other end, and the page is built around that distinction:
 *
 *   - **Mode déclaré** is what an administrator has decided here.
 *   - **Environnement** is what the running server actually has configured.
 *   - When a connector is declared PRODUCTION with nothing in the environment, the page says
 *     so in red. Setting the mode is a statement of intent, not a connection.
 *
 * The test button reports what it observed. For SMTP, when a host is recorded, it resolves
 * the name and says plainly that resolution proves the name exists, not that mail will be
 * accepted. For every other connector it answers "rien à joindre" — because a test that
 * always returns "connexion réussie" only ever tests itself.
 */
export default function IntegrationsPage() {
  const { t, i18n } = useTranslation();
  const [connectors, setConnectors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busyKey, setBusyKey] = useState(null);
  const [tests, setTests] = useState({});
  const [notice, setNotice] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const payload = await adminApi.connectors();
      setConnectors(payload.data ?? []);
      setSummary(payload.summary ?? null);
      setError(null);
    } catch {
      setError(t('admin.integrations.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const mismatched = useMemo(() => connectors.filter((row) => row.envMismatch), [connectors]);

  function draftFor(connector) {
    return drafts[connector.key] ?? connector.config ?? {};
  }

  function setDraftField(key, field, value) {
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? connectors.find((row) => row.key === key)?.config ?? {}), [field]: value },
    }));
  }

  async function handleToggleMode(connector) {
    const next = connector.mode === 'PRODUCTION' ? 'MOCK' : 'PRODUCTION';
    if (
      next === 'PRODUCTION' &&
      connector.envMode !== 'production' &&
      !window.confirm(t('admin.integrations.confirmProductionSwitch', { label: connector.definition.labelFr }))
    ) {
      return;
    }

    setBusyKey(connector.key);
    setNotice(null);
    try {
      await adminApi.updateConnector(connector.key, { mode: next });
      await load();
      setNotice({
        tone: next === 'PRODUCTION' && connector.envMode !== 'production' ? 'warn' : 'ok',
        text:
          next === 'PRODUCTION' && connector.envMode !== 'production'
            ? t('admin.integrations.declaredProductionUnreachable', { label: connector.definition.labelFr })
            : t('admin.integrations.switchedTo', {
                label: connector.definition.labelFr,
                mode: t(`admin.integrations.mode.${next.toLowerCase()}`).toLowerCase(),
              }),
      });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? t('admin.integrations.toggleFailed') });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveConfig(connector) {
    setBusyKey(connector.key);
    setNotice(null);
    try {
      await adminApi.updateConnector(connector.key, { config: draftFor(connector) });
      setDrafts((current) => {
        const next = { ...current };
        delete next[connector.key];
        return next;
      });
      await load();
      setNotice({ tone: 'ok', text: t('admin.integrations.configSaved') });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? t('admin.integrations.saveFailed') });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleTest(connector) {
    setBusyKey(connector.key);
    setNotice(null);
    try {
      const result = await adminApi.testConnector(connector.key);
      setTests((current) => ({ ...current, [connector.key]: result }));
      await load();
    } catch (err) {
      setTests((current) => ({
        ...current,
        [connector.key]: {
          ok: false,
          reason: 'error',
          detailFr: err.body?.message ?? t('admin.integrations.testFailedFallback'),
          checkedFr: t('admin.integrations.testNoneRun'),
        },
      }));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <PageLoading label={t('admin.integrations.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('admin.integrations.eyebrow')}
        title={t('admin.integrations.title')}
        subtitle={t('admin.integrations.subtitle')}
        actions={
          <button type="button" onClick={load} className={SECONDARY_BUTTON}>
            {t('admin.integrations.refresh')}
          </button>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-3"
      >
        <Tile label={t('admin.integrations.tiles.production')} value={summary?.production ?? 0} />
        <Tile label={t('admin.integrations.tiles.mock')} value={summary?.mock ?? 0} />
        <Tile
          label={t('admin.integrations.tiles.mismatched')}
          value={summary?.mismatched ?? 0}
          tone={(summary?.mismatched ?? 0) > 0 ? 'red' : undefined}
        />
      </motion.div>

      <AnimatePresence initial={false}>
        {notice && (
          <motion.p
            key={notice.text}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mb-4 overflow-hidden rounded-app border p-3 text-sm ${
              notice.tone === 'warn'
                ? 'border-status-amber/40 bg-status-amber/5 text-status-amber'
                : 'border-status-green/30 bg-status-green/5 text-status-green'
            }`}
          >
            {notice.text}
          </motion.p>
        )}
      </AnimatePresence>

      {mismatched.length > 0 && (
        <div className="mb-6 rounded-app border border-status-red/30 bg-status-red/5 p-4 text-sm text-status-red">
          <p className="font-medium">{t('admin.integrations.mismatchedWarning', { count: mismatched.length })}</p>
          <p className="mt-1">{t('admin.integrations.mismatchedWarningBody')}</p>
        </div>
      )}

      <motion.div
        variants={staggerContainer(0.05)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="space-y-3"
      >
        {connectors.map((connector) => {
          const modeKey = connector.mode === 'PRODUCTION' ? 'production' : 'mock';
          const pill = MODE_PILL[connector.mode] ?? MODE_PILL.MOCK;
          const fields = CONFIG_FIELDS[connector.key] ?? [];
          const open = expanded === connector.key;
          const test = tests[connector.key];
          const draft = draftFor(connector);
          const dirty = Boolean(drafts[connector.key]);

          return (
            <motion.article key={connector.key} variants={staggerItem} className={`${CARD} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-text">{connector.definition.labelFr}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill}`}>
                      {t(`admin.integrations.mode.${modeKey}`)}
                    </span>
                    {connector.envMismatch && (
                      <span className="rounded-full bg-status-red/10 px-2 py-0.5 text-xs font-medium text-status-red">
                        {t('admin.integrations.notConfigured')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-dim">
                    {t(`admin.integrations.mode.${modeKey}Meaning`)}
                  </p>
                  {connector.mode === 'MOCK' && (
                    <p className="mt-1 text-sm text-text-dim">{connector.definition.consequenceFr}</p>
                  )}
                  <p className="mt-2 text-xs text-text-dim">
                    {t('admin.integrations.env.label')}{' '}
                    {t(`admin.integrations.env.${connector.envMode}`, connector.envMode)}{' '}
                    <code className="font-mono text-[10px]">{connector.definition.envVar}</code>
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {/* The Plug & Play switch itself. */}
                  <Toggle
                    size="lg"
                    tone="green"
                    checked={connector.mode === 'PRODUCTION'}
                    disabled={busyKey === connector.key}
                    onChange={() => handleToggleMode(connector)}
                    label={t('admin.integrations.toggleLabel', { label: connector.definition.labelFr })}
                  />
                  <span className="text-[10px] uppercase tracking-wide text-text-dim">
                    {t('admin.integrations.toggleCaption')}
                  </span>

                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      disabled={busyKey === connector.key}
                      onClick={() => handleTest(connector)}
                      className="text-red-brand hover:underline disabled:opacity-60"
                    >
                      {t('admin.integrations.test')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : connector.key)}
                      className="text-text-dim transition-colors hover:text-red-brand hover:underline"
                    >
                      {open ? t('admin.integrations.close') : t('admin.integrations.configure')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Test outcome */}
              <AnimatePresence initial={false}>
                {test && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className={`mt-4 rounded-app border p-3 text-sm ${
                        test.ok
                          ? 'border-status-green/30 bg-status-green/5 text-status-green'
                          : 'border-border bg-surface-2/60 text-text-dim'
                      }`}
                    >
                      <p className="font-medium">
                        {test.ok
                          ? t('admin.integrations.testOutcome.ok')
                          : t(`admin.integrations.testReasons.${test.reason}`, t('admin.integrations.testOutcome.failed'))}
                      </p>
                      <p className="mt-1">{test.detailFr}</p>
                      <p className="mt-1 text-xs opacity-80">{test.checkedFr}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Config editor */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 border-t border-border pt-4">
                      {fields.length === 0 ? (
                        <p className="text-sm text-text-dim">{t('admin.integrations.noFieldsYet')}</p>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {fields.map((field) => (
                              <div key={field.key}>
                                <label className="mb-1 block text-sm font-medium text-text">
                                  {t(`admin.integrations.fields.${field.labelKey}`)}
                                </label>
                                <input
                                  value={draft[field.key] ?? ''}
                                  placeholder={field.placeholderKey ? t(`admin.integrations.fields.${field.placeholderKey}`) : field.placeholder}
                                  onChange={(e) => setDraftField(connector.key, field.key, e.target.value)}
                                  className={FIELD}
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              disabled={busyKey === connector.key || !dirty}
                              onClick={() => handleSaveConfig(connector)}
                              className={PRIMARY_BUTTON}
                            >
                              {busyKey === connector.key ? t('common.states.saving') : t('common.actions.save')}
                            </button>
                          </div>
                        </>
                      )}

                      {connector.lastTestedAt && (
                        <p className="mt-3 text-xs text-text-dim">
                          {t('admin.integrations.lastTested', { date: new Date(connector.lastTestedAt).toLocaleString(localeOf(i18n)) })}{' '}
                          {connector.lastTestOk ? t('admin.integrations.lastTestOk') : t('admin.integrations.lastTestFailed')}.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </motion.div>

      {connectors.length === 0 && (
        <EmptyState title={t('admin.integrations.empty')} detail={t('admin.integrations.emptyDetail')} muted />
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <p className="text-sm font-medium text-text-muted">{t('admin.integrations.whatSwitchDoes.title')}</p>
          <p className="mt-1 text-sm text-text-dim">{t('admin.integrations.whatSwitchDoes.body')}</p>
        </div>
        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <p className="text-sm font-medium text-text-muted">{t('admin.integrations.whatSwitchDoesNot.title')}</p>
          <p className="mt-1 text-sm text-text-dim">{t('admin.integrations.whatSwitchDoesNot.body')}</p>
        </div>
      </div>
    </div>
  );
}

const PRIMARY_BUTTON =
  'rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60';
const SECONDARY_BUTTON =
  'rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand';

function Tile({ label, value, tone }) {
  return (
    <motion.div variants={staggerItem} className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={`font-display text-3xl ${tone === 'red' ? 'text-status-red' : 'text-red-deep'}`}>
        <CountUp value={value} />
      </p>
    </motion.div>
  );
}
