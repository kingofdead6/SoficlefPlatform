import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { adminApi } from '../../../api/admin.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';
import { sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import Toggle from '../../../components/ui/Toggle.jsx';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const field =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/** Which keys belong in which section, so the page reads as the spec's list rather than a flat dump. */
const SECTIONS = [
  { id: 'brand', titleFr: 'Marque', keys: ['brandNameFr', 'brandTaglineFr'] },
  { id: 'locale', titleFr: 'Langues', keys: ['defaultLocale'] },
  {
    id: 'email',
    titleFr: 'Modèles d’e-mail',
    keys: ['emailWelcomeSubjectFr', 'emailWelcomeBodyFr'],
    noteFr:
      'Enregistrés seulement : aucun relais SMTP n’est raccordé, donc rien n’est envoyé depuis la plateforme.',
  },
  { id: 'milestones', titleFr: 'Jalons', keys: ['milestonesFr'] },
  {
    id: 'flags',
    titleFr: 'Fonctionnalités',
    keys: ['featureAssistant', 'featureSurveys', 'featureTraining'],
  },
];


/**
 * /admin/settings (route guide §2.4, SITE).
 * "Branding, languages, email templates, milestone definitions, org chart visibility depth
 * per role, feature flags."
 *
 * Everything here is a row in `app_setting`, edited through PATCH /admin/settings and
 * audited like any other mutation. A value nobody has ever set is shown as its documented
 * default and marked as such, so "the default happens to be 3" reads differently from
 * "somebody chose 3".
 */
export default function AdminSettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const reduce = useReducedMotion();

  async function load() {
    try {
      setData(await adminApi.settings());
    } catch {
      setError('Impossible de charger les paramètres.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key, value) {
    setSavingKey(key);
    setError(null);
    try {
      await adminApi.updateSetting(key, value);
      await load();
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 1500);
    } catch {
      setError(`La mise à jour de « ${key} » a échoué.`);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <PageLoading label="Chargement des paramètres…" />;
  if (error && !data) return <PageError message={error} />;
  if (!data) return null;

  const { orgTree, values, labels, keys, isDefault } = data;
  const labelFor = (key) => labels?.[keys[key]] ?? labels?.[key] ?? key;
  const keyName = (key) => keys?.[key] ?? key;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Paramètres"
        subtitle="Réglages modifiables sans déploiement. Chaque changement est journalisé."
      />

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10"
      >
        <h2 className="mb-1 font-display text-xl text-text">Visibilité de l'organigramme</h2>
        <p className="mb-4 max-w-2xl text-sm text-text-dim">
          Combien de niveaux un collaborateur voit autour de son propre poste. Les rôles
          d'encadrement et les RH ne sont pas limités par ces valeurs.
        </p>

        <div className={`${CARD} max-w-2xl space-y-4 p-5`}>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-text">Niveaux visibles vers le haut</span>
              <span className="block text-xs text-text-dim">Du poste vers la direction.</span>
            </span>
            <input
              type="number"
              min={0}
              max={12}
              defaultValue={orgTree.depthUp}
              disabled={savingKey === keyName('orgTreeDepthUp')}
              onBlur={(e) => {
                const next = Number(e.target.value);
                if (next !== orgTree.depthUp) save(keyName('orgTreeDepthUp'), next);
              }}
              className={`${field} w-24`}
            />
          </label>

          <label className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <span>
              <span className="block text-sm font-medium text-text">Niveaux visibles vers le bas</span>
              <span className="block text-xs text-text-dim">Du poste vers les équipes.</span>
            </span>
            <input
              type="number"
              min={0}
              max={12}
              defaultValue={orgTree.depthDown}
              disabled={savingKey === keyName('orgTreeDepthDown')}
              onBlur={(e) => {
                const next = Number(e.target.value);
                if (next !== orgTree.depthDown) save(keyName('orgTreeDepthDown'), next);
              }}
              className={`${field} w-24`}
            />
          </label>

          <label className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <span>
              <span className="block text-sm font-medium text-text">Afficher les collègues</span>
              <span className="block text-xs text-text-dim">Les postes de même niveau hiérarchique.</span>
            </span>
            <Toggle
              checked={orgTree.showPeers}
              disabled={savingKey === keyName('orgTreeShowPeers')}
              onChange={(next) => save(keyName('orgTreeShowPeers'), next)}
            />
          </label>
        </div>
      </motion.section>

      {SECTIONS.map((section, index) => (
        <motion.section
          key={section.id}
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.05 * (index + 1) }}
          className="mb-10"
        >
          <h2 className="mb-1 font-display text-xl text-text">{section.titleFr}</h2>
          {section.noteFr && <p className="mb-4 max-w-2xl text-sm text-text-dim">{section.noteFr}</p>}

          <div className={`${CARD} max-w-2xl divide-y divide-border p-5`}>
            {section.keys.map((shortKey) => {
              const key = keyName(shortKey);
              const value = values?.[key];
              const untouched = isDefault?.[key];
              const isBoolean = typeof value === 'boolean';
              const isLong = shortKey === 'emailWelcomeBodyFr' || shortKey === 'milestonesFr';

              return (
                <div key={key} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-text">{labelFor(shortKey)}</span>
                      <span className="block font-mono text-[11px] text-text-dim">
                        {key}
                        {untouched ? ' · valeur par défaut' : ''}
                      </span>
                    </span>

                    {isBoolean ? (
                      <Toggle
                        checked={value}
                        disabled={savingKey === key}
                        onChange={(next) => save(key, next)}
                      />
                    ) : isLong ? null : (
                      <input
                        type="text"
                        defaultValue={value ?? ''}
                        disabled={savingKey === key}
                        onBlur={(e) => {
                          if (e.target.value !== (value ?? '')) save(key, e.target.value);
                        }}
                        className={`${field} w-64`}
                      />
                    )}

                    {savedKey === key && <span className="text-xs text-status-green">Enregistré.</span>}
                  </div>

                  {isLong && (
                    <textarea
                      rows={shortKey === 'milestonesFr' ? 3 : 5}
                      defaultValue={value ?? ''}
                      disabled={savingKey === key}
                      onBlur={(e) => {
                        if (e.target.value !== (value ?? '')) save(key, e.target.value);
                      }}
                      className={`${field} w-full`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>
      ))}

      <p className="text-sm text-text-dim">
        Les autres réglages — durées de session, paramètres de hachage, URL de base de
        données — sont fixés au déploiement et ne sont pas modifiables ici.
      </p>

      {error && <p className="mt-3 text-sm text-status-red">{error}</p>}
    </div>
  );
}
