import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { positionsApi } from '../../../api/organization.js';
import { templatesApi } from '../../../api/templates.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useAuth } from '../../../auth/AuthContext.jsx';
import { can } from '../../../lib/permissions.js';
import { staggerContainer, staggerItem, cardHover, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /app/hr/templates (route guide §2.3, CORE).
 * "Library of onboarding path templates by profile."
 *
 * A template's "profile" is the position it is written for, which is how the assignment form
 * proposes the right path. Templates with no position are the generic ones.
 *
 * HR holds `onboarding_template:read` and not `:create` — the catalogue gives creation to
 * ADMIN. The creation control is therefore rendered only for a caller who actually holds it.
 */
export default function HrTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ slug: '', titleFr: '', positionId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const reduce = useReducedMotion();

  const canCreate = can(user, 'create', 'onboarding_template');

  const load = useCallback(async () => {
    try {
      const { data } = await templatesApi.list();
      setTemplates(data);
      setError(null);
    } catch {
      setError('Impossible de charger les modèles de parcours.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canCreate) return;
    (async () => {
      try {
        const { data } = await positionsApi.list();
        setPositions(data);
      } catch {
        setPositions([]);
      }
    })();
  }, [canCreate]);

  const stats = useMemo(
    () => ({
      total: templates.length,
      steps: templates.reduce((sum, template) => sum + template.milestoneCount, 0),
      running: templates.reduce((sum, template) => sum + template.instanceCount, 0),
    }),
    [templates],
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await templatesApi.create({
        slug: form.slug,
        titleFr: form.titleFr,
        positionId: form.positionId || null,
      });
      setForm({ slug: '', titleFr: '', positionId: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? 'La création du modèle a échoué.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Chargement des modèles…" />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Ressources humaines"
        title="Modèles d’intégration"
        subtitle="La bibliothèque des parcours types, par profil de poste."
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setShowForm((open) => !open)}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {showForm ? 'Annuler' : 'Nouveau modèle'}
            </button>
          ) : null
        }
      />

      {!canCreate && (
        <div className="mb-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
          Votre rôle donne un accès en lecture à la bibliothèque de modèles. La création et la
          modification d’un modèle relèvent de l’administration (permissions{' '}
          <code>onboarding_template:create</code> / <code>onboarding_template:update</code>).
        </div>
      )}

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-3"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Modèles disponibles
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.total} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Étapes décrites
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.steps} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            Parcours générés
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.running} />
          </p>
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {showForm && canCreate && (
          <motion.form
            onSubmit={handleSubmit}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">Nouveau modèle</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Code du modèle</label>
                  <input
                    required
                    pattern="[a-z0-9-]+"
                    placeholder="parcours-cadre"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className={fieldClass}
                  />
                  <p className="mt-1 text-xs text-text-dim">Minuscules, chiffres et tirets.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">Intitulé</label>
                  <input
                    required
                    value={form.titleFr}
                    onChange={(e) => setForm((f) => ({ ...f, titleFr: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">Profil de poste</label>
                <select
                  value={form.positionId}
                  onChange={(e) => setForm((f) => ({ ...f, positionId: e.target.value }))}
                  className={fieldClass}
                >
                  <option value="">Modèle générique (tous profils)</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.titleFr} ({position.code})
                    </option>
                  ))}
                </select>
              </div>

              {formError && <p className="text-sm text-status-red">{formError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
                >
                  {submitting ? 'Création…' : 'Créer le modèle'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {templates.length === 0 ? (
        <EmptyState
          title="Aucun modèle"
          detail="La bibliothèque de parcours est vide. Un modèle décrit la séquence d’étapes qu’un profil suit à son arrivée."
          muted
        />
      ) : (
        <motion.div
          variants={staggerContainer(0.06)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {templates.map((template) => (
            <motion.div key={template.id} variants={staggerItem} initial="rest" whileHover="hover">
              <motion.div variants={cardHover}>
                <Link
                  to={`/app/hr/templates/${template.id}`}
                  className={`block ${CARD} p-5 transition-colors hover:border-red-brand`}
                >
                  <p className="font-display text-lg text-text">{template.titleFr}</p>
                  <p className="font-mono text-[10px] text-text-dim">{template.slug}</p>
                  <p className="mt-2 text-xs text-text-dim">
                    {template.position
                      ? `Profil : ${template.position.titleFr}`
                      : 'Modèle générique — tous profils'}
                  </p>
                  <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-xs text-text-dim">
                    <span className="rounded-full bg-red-brand/10 px-2 py-0.5 font-medium text-red-brand">
                      {template.milestoneCount} étape{template.milestoneCount > 1 ? 's' : ''}
                    </span>
                    <span>
                      {template.instanceCount} parcours généré{template.instanceCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </Link>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
