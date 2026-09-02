import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { adminApi } from '../../../api/admin.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import Toggle from '../../../components/ui/Toggle.jsx';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const FIELD =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const MODE_META = {
  PRODUCTION: {
    labelFr: 'Production',
    pill: 'bg-status-green/10 text-status-green',
    meaningFr: 'Le connecteur doit s’adresser au système réel.',
  },
  MOCK: {
    labelFr: 'Simulé',
    pill: 'bg-red-brand/10 text-red-brand',
    meaningFr: 'Le connecteur répond avec des données de démonstration, volontairement.',
  },
};

const ENV_META = {
  production: 'Une adresse est configurée dans l’environnement du serveur.',
  mock: 'La variable d’environnement vaut « mock ».',
  unconfigured: 'Aucune adresse n’est configurée dans l’environnement du serveur.',
};

/**
 * Which config fields each connector offers. Deliberately a small, explicit map rather than
 * a free-form JSON editor: an administrator setting up SMTP should see "hôte" and "port",
 * not be asked to hand-write a JSON object whose keys nobody validates. A connector absent
 * from this map is still listed and switchable — it simply has no fields yet.
 */
const CONFIG_FIELDS = {
  smtp: [
    { key: 'host', labelFr: 'Hôte SMTP', placeholder: 'smtp.soficlef.dz' },
    { key: 'port', labelFr: 'Port', placeholder: '587' },
    { key: 'from', labelFr: 'Expéditeur', placeholder: 'no-reply@soficlef.dz' },
  ],
  entra: [
    { key: 'tenantId', labelFr: 'Identifiant du locataire', placeholder: 'Aucun locataire disponible' },
    { key: 'clientId', labelFr: 'Identifiant de l’application', placeholder: '' },
  ],
  hrApi: [{ key: 'baseUrl', labelFr: 'URL de base du SIRH', placeholder: 'https://sirh.example/api' }],
  directory: [{ key: 'path', labelFr: 'Chemin du partage', placeholder: '\\\\serveur\\partage' }],
  storage: [{ key: 'driver', labelFr: 'Pilote de stockage', placeholder: 's3 | local' }],
  ai: [
    { key: 'endpoint', labelFr: 'Adresse du fournisseur', placeholder: 'https://…' },
    { key: 'model', labelFr: 'Modèle', placeholder: '' },
  ],
};

const TEST_REASON_LABELS = {
  not_configured: 'Rien à joindre',
  unreachable: 'Injoignable',
  resolved: 'Nom résolu',
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
      setError('Impossible de charger les connecteurs.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      !window.confirm(
        `Passer « ${connector.definition.labelFr} » en production ? Aucune adresse n’est configurée dans l’environnement du serveur : le connecteur sera déclaré en production sans être raccordé.`,
      )
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
            ? `« ${connector.definition.labelFr} » est déclaré en production, mais l’environnement du serveur ne lui donne aucune adresse.`
            : `« ${connector.definition.labelFr} » est désormais en ${MODE_META[next].labelFr.toLowerCase()}.`,
      });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? 'Le changement de mode a échoué.' });
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
      setNotice({ tone: 'ok', text: 'Configuration enregistrée.' });
    } catch (err) {
      setNotice({ tone: 'warn', text: err.body?.message ?? 'L’enregistrement a échoué.' });
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
          detailFr: err.body?.message ?? 'Le test n’a pas pu être exécuté.',
          checkedFr: 'Aucun test effectué.',
        },
      }));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) return <PageLoading label="Chargement des connecteurs…" />;
  if (error) return <PageError message={error} />;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Administration"
        title="Intégrations"
        subtitle="Ce à quoi la plateforme est raccordée, ce qu’elle est censée l’être, et l’écart entre les deux."
        actions={
          <button type="button" onClick={load} className={SECONDARY_BUTTON}>
            Actualiser
          </button>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-3"
      >
        <Tile label="Déclarés en production" value={summary?.production ?? 0} />
        <Tile label="En mode simulé" value={summary?.mock ?? 0} />
        <Tile
          label="Déclarés sans être raccordés"
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
          <p className="font-medium">
            {mismatched.length} connecteur(s) déclarés en production sans adresse dans
            l’environnement du serveur.
          </p>
          <p className="mt-1">
            Le mode enregistré ici est une intention. Le raccordement, lui, se fait par
            variable d’environnement au déploiement : tant qu’elle est vide, rien ne part.
          </p>
        </div>
      )}

      <motion.div
        variants={staggerContainer(0.05)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="space-y-3"
      >
        {connectors.map((connector) => {
          const meta = MODE_META[connector.mode] ?? MODE_META.MOCK;
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
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.pill}`}>
                      {meta.labelFr}
                    </span>
                    {connector.envMismatch && (
                      <span className="rounded-full bg-status-red/10 px-2 py-0.5 text-xs font-medium text-status-red">
                        Non raccordé
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-dim">{meta.meaningFr}</p>
                  {connector.mode === 'MOCK' && (
                    <p className="mt-1 text-sm text-text-dim">{connector.definition.consequenceFr}</p>
                  )}
                  <p className="mt-2 text-xs text-text-dim">
                    Environnement : {ENV_META[connector.envMode] ?? connector.envMode}{' '}
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
                    label={`Basculer ${connector.definition.labelFr}`}
                  />
                  <span className="text-[10px] uppercase tracking-wide text-text-dim">
                    Simulé ↔ Production
                  </span>

                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      disabled={busyKey === connector.key}
                      onClick={() => handleTest(connector)}
                      className="text-red-brand hover:underline disabled:opacity-60"
                    >
                      Tester
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : connector.key)}
                      className="text-text-dim transition-colors hover:text-red-brand hover:underline"
                    >
                      {open ? 'Fermer' : 'Configurer'}
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
                        {test.ok ? 'Vérification effectuée' : TEST_REASON_LABELS[test.reason] ?? 'Échec'}
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
                        <p className="text-sm text-text-dim">
                          Ce connecteur n’a pas encore de paramètres à saisir : seul son mode
                          est réglable ici.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {fields.map((field) => (
                              <div key={field.key}>
                                <label className="mb-1 block text-sm font-medium text-text">
                                  {field.labelFr}
                                </label>
                                <input
                                  value={draft[field.key] ?? ''}
                                  placeholder={field.placeholder}
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
                              {busyKey === connector.key ? 'Enregistrement…' : 'Enregistrer'}
                            </button>
                          </div>
                        </>
                      )}

                      {connector.lastTestedAt && (
                        <p className="mt-3 text-xs text-text-dim">
                          Dernier test : {new Date(connector.lastTestedAt).toLocaleString('fr-FR')} —{' '}
                          {connector.lastTestOk ? 'vérification concluante' : 'sans succès'}.
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
        <EmptyState title="Aucun connecteur déclaré" detail="Le catalogue des connecteurs est vide." muted />
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <p className="text-sm font-medium text-text-muted">Ce que le commutateur fait</p>
          <p className="mt-1 text-sm text-text-dim">
            Il enregistre durablement le mode voulu pour chaque connecteur, avec une entrée
            dans le journal d’audit. C’est l’intention déclarée par l’administration.
          </p>
        </div>
        <div className="rounded-app border border-dashed border-border bg-surface-2/60 p-4">
          <p className="text-sm font-medium text-text-muted">Ce qu’il ne fait pas</p>
          <p className="mt-1 text-sm text-text-dim">
            Il ne raccorde aucun système : l’adresse réelle vient de l’environnement du
            serveur, fixé au déploiement. Aucun locataire Entra ID, aucun SIRH et aucun
            relais SMTP ne répond à ce déploiement — le bouton « Tester » le dit
            explicitement plutôt que d’afficher un vert de complaisance.
          </p>
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
