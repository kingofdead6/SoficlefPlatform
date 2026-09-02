import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { adminApi } from '../../../api/admin.js';
import { assistantApi } from '../../../api/assistant.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import Toggle from '../../../components/ui/Toggle.jsx';

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
  const [config, setConfig] = useState(null);
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState(null);
  const [agents, setAgents] = useState([]);
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
      setForm({
        provider: configRes.data.provider ?? '',
        endpoint: configRes.data.endpoint ?? '',
        model: configRes.data.model ?? '',
        monthlyQuota: configRes.data.monthlyQuota ?? '',
      });
      setPrompts(configRes.data.promptTemplates ?? {});
      setError(null);
    } catch {
      setError('Impossible de charger la configuration IA.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setNotice({ tone: 'warn', text: err.body?.message ?? 'L’enregistrement a échoué.' });
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
      'Configuration du fournisseur enregistrée.',
    );
  }

  async function handleToggleAgent(agentId) {
    await patch(
      { agentsEnabled: { [agentId]: !enabled[agentId] } },
      enabled[agentId] ? 'Agent désactivé.' : 'Agent activé.',
    );
  }

  async function handleSavePrompt(agentId) {
    await patch({ promptTemplates: { [agentId]: prompts[agentId] ?? '' } }, 'Modèle de prompt enregistré.');
    setOpenPrompt(null);
  }

  if (loading) return <PageLoading label="Chargement de la configuration IA…" />;
  if (error) return <PageError message={error} />;

  const agentById = new Map(agents.map((agent) => [agent.id, agent]));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Administration"
        title="Configuration IA"
        subtitle="Fournisseur, modèle, quota, agents et modèles de prompts — enregistrés durablement, en attente d’un fournisseur à brancher."
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Tile label="Agents déclarés" value={stats.declared} />
        <Tile label="Agents activés" value={stats.enabled} />
        <Tile label="Opérationnels sans LLM" value={stats.operational} />
        <Tile label="Prompts renseignés" value={stats.prompts} />
      </motion.div>

      {/* The banner that must never be missed. */}
      <div
        className={`mb-6 rounded-app border p-4 ${
          meta.providerConnected
            ? 'border-status-green/30 bg-status-green/5'
            : 'border-red-brand/40 bg-red-brand/5'
        }`}
      >
        <p className="text-sm font-medium text-text">
          {meta.providerConnected
            ? 'Un fournisseur est raccordé à l’environnement du serveur.'
            : 'Aucun fournisseur de modèle de langage n’est raccordé.'}
        </p>
        <p className="mt-1 text-sm text-text-dim">
          {meta.providerConnected
            ? 'Les réglages ci-dessous décrivent l’usage attendu ; leur consommation effective dépend de l’implémentation du client côté serveur.'
            : 'C’est une décision d’architecture, pas un oubli : aucune fonction métier de la plateforme ne doit dépendre d’un service externe tant qu’il n’est pas contractualisé. Les réglages ci-dessous sont enregistrés et vous attendent — ils ne sont lus par personne aujourd’hui, et aucun appel à un modèle n’est émis depuis ce serveur.'}
        </p>
        <p className="mt-2 font-mono text-[11px] text-text-dim">{meta.envVar}</p>
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
        <h2 className="font-display text-lg text-text">Fournisseur, modèle et quota</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Labelled label="Fournisseur" hint="Nom du prestataire retenu.">
            <input
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              placeholder="Aucun fournisseur retenu"
              className={FIELD}
            />
          </Labelled>
          <Labelled label="Adresse (endpoint)">
            <input
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              placeholder="https://…"
              className={FIELD}
            />
          </Labelled>
          <Labelled label="Modèle">
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className={FIELD}
            />
          </Labelled>
          <Labelled label="Quota mensuel" hint="En requêtes. Vide = pas de plafond fixé.">
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
              ? `Dernière modification : ${new Date(config.updatedAt).toLocaleString('fr-FR')}.`
              : 'Aucune configuration enregistrée pour l’instant.'}
          </p>
          <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>

      {/* Agents */}
      <section className="mb-8">
        <h2 className="mb-1 font-display text-xl text-text">Agents</h2>
        <p className="mb-4 text-sm text-text-dim">
          Un agent lit avec les droits de celui qui l’interroge : il ne peut jamais faire
          remonter une ligne que la personne ne pourrait pas ouvrir elle-même. Activer un
          agent enregistre l’intention ; les agents marqués « opérationnel » répondent déjà,
          par recherche dans les données de la plateforme, sans aucun modèle de langage.
        </p>

        {meta.agents.length === 0 ? (
          <EmptyState muted title="Aucun agent déclaré" detail="Le catalogue des agents est vide." />
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
                          {agent?.live ? 'Opérationnel sans LLM' : 'En attente du fournisseur'}
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
                        label={`Activer ${agent?.titleFr ?? agentId}`}
                      />
                      <button
                        type="button"
                        onClick={() => setOpenPrompt(promptOpen ? null : agentId)}
                        className="text-xs text-red-brand hover:underline"
                      >
                        {promptOpen ? 'Fermer' : promptValue ? 'Modifier le prompt' : 'Définir un prompt'}
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
                            Modèle de prompt
                          </label>
                          <textarea
                            rows={4}
                            value={promptValue}
                            onChange={(e) => setPrompts((current) => ({ ...current, [agentId]: e.target.value }))}
                            placeholder="Consigne donnée à l’agent. La règle qui vaut déjà, sans fournisseur : toute réponse cite sa source, ou reconnaît n’avoir rien trouvé."
                            className={FIELD}
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button type="button" onClick={() => setOpenPrompt(null)} className={SECONDARY_BUTTON}>
                              Annuler
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleSavePrompt(agentId)}
                              className={PRIMARY_BUTTON}
                            >
                              Enregistrer le prompt
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
        Rien sur cette page n’émet d’appel vers un modèle de langage, et rien ne le lira tant
        qu’un fournisseur ne sera pas contractualisé et raccordé (page Intégrations). Les
        {' '}{status?.agentsOperational ?? stats.operational} agent(s) marqué(s) « opérationnel »
        fonctionnent par recherche dans les données de la plateforme, avec les droits de la
        personne qui pose la question — c’est ce qui existe réellement aujourd’hui.
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
