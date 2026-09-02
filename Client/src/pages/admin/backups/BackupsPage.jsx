import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { adminApi } from '../../../api/admin.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const field =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const EMPTY_FORM = { labelFr: '', cronFr: '', retentionDays: 30, isActive: true };

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const value = Number(bytes);
  if (!Number.isFinite(value)) return String(bytes);
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let index = 0;
  let size = value;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * /admin/backups (route guide §2.4, LATER).
 * "Schedule, history, restore, retention."
 *
 * The schedules are real, owned rows: creating, editing and deleting one is a genuine,
 * audited mutation. The history is not — no process in this repository executes a backup,
 * so `backup_run` is never written to. The server says as much (`executorAvailable: false`
 * plus `emptyReasonFr`), and that answer is shown rather than an empty table that would
 * read as "no backup has ever failed".
 *
 * Restore is deliberately absent: an action that cannot run must not have a button.
 */
export default function BackupsPage() {
  const [report, setReport] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [runs, setRuns] = useState([]);
  const [runsMeta, setRunsMeta] = useState({ executorAvailable: false, emptyReasonFr: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const reduce = useReducedMotion();

  async function load() {
    try {
      const [reportRes, schedulesRes, runsRes] = await Promise.all([
        adminApi.backups(),
        adminApi.backupSchedules(),
        adminApi.backupRuns(50),
      ]);
      setReport(reportRes.data ?? reportRes);
      setSchedules(schedulesRes.data ?? []);
      setRuns(runsRes.data ?? []);
      setRunsMeta({
        executorAvailable: Boolean(runsRes.executorAvailable),
        emptyReasonFr: runsRes.emptyReasonFr ?? null,
      });
    } catch {
      setError('Impossible de charger les sauvegardes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createSchedule(event) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await adminApi.createBackupSchedule(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch {
      setError("La création de la planification a échoué.");
    } finally {
      setCreating(false);
    }
  }

  async function toggle(schedule) {
    try {
      await adminApi.updateBackupSchedule(schedule.id, { isActive: !schedule.isActive });
      await load();
    } catch {
      setError('La mise à jour a échoué.');
    }
  }

  async function remove(schedule) {
    if (!window.confirm(`Supprimer la planification « ${schedule.labelFr} » ?`)) return;
    try {
      await adminApi.deleteBackupSchedule(schedule.id);
      await load();
    } catch {
      setError('La suppression a échoué.');
    }
  }

  if (loading) return <PageLoading label="Chargement des sauvegardes…" />;
  if (error && !report) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Sauvegardes"
        subtitle="Planifications de sauvegarde et historique d'exécution."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
          >
            {showForm ? 'Annuler' : 'Nouvelle planification'}
          </button>
        }
      />

      <div className="mb-8 rounded-app border border-red-brand/40 bg-red-brand/5 p-4 text-sm text-text-dim">
        <p className="font-medium text-text">Aucun exécuteur de sauvegarde n'est raccordé.</p>
        <p className="mt-1">
          Les planifications ci-dessous sont enregistrées et journalisées, mais rien dans cette
          application ne les déclenche : aucune sauvegarde ne part, et aucune restauration
          n'est possible depuis cet écran. La sauvegarde effective relève aujourd'hui de
          l'hébergeur de la base.
        </p>
      </div>

      {report && (
        <motion.div
          variants={staggerContainer(0.06)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {Object.entries(report)
            .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
            .slice(0, 4)
            .map(([key, value]) => (
              <motion.div key={key} variants={staggerItem} className={`${CARD} p-5`}>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{key}</p>
                <p className="font-display text-2xl text-red-deep">{String(value)}</p>
              </motion.div>
            ))}
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={createSchedule}
            className="mb-8 overflow-hidden"
          >
            <div className={`${CARD} grid gap-3 p-5 sm:grid-cols-2`}>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text">Libellé</span>
                <input
                  required
                  value={form.labelFr}
                  onChange={(e) => setForm((prev) => ({ ...prev, labelFr: e.target.value }))}
                  placeholder="Sauvegarde quotidienne"
                  className={`${field} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text">Fréquence</span>
                <input
                  required
                  value={form.cronFr}
                  onChange={(e) => setForm((prev) => ({ ...prev, cronFr: e.target.value }))}
                  placeholder="Tous les jours à 02 h 00"
                  className={`${field} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text">Rétention (jours)</span>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={form.retentionDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, retentionDays: Number(e.target.value) }))}
                  className={`${field} w-full`}
                />
              </label>
              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
                >
                  {creating ? 'Enregistrement…' : 'Créer'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-10"
      >
        <h2 className="mb-3 font-display text-xl text-text">Planifications ({schedules.length})</h2>
        {schedules.length === 0 ? (
          <EmptyState detail="Aucune planification enregistrée." />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Libellé</th>
                  <th className="px-4 py-3 font-medium">Fréquence</th>
                  <th className="px-4 py-3 font-medium">Rétention</th>
                  <th className="px-4 py-3 font-medium">État</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible">
                {schedules.map((schedule) => (
                  <motion.tr
                    key={schedule.id}
                    variants={staggerItem}
                    className="border-b border-border last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3 text-text">{schedule.labelFr}</td>
                    <td className="px-4 py-3 text-text-dim">{schedule.cronFr}</td>
                    <td className="px-4 py-3 text-text-dim">{schedule.retentionDays} j</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          schedule.isActive
                            ? 'bg-status-green/10 text-status-green'
                            : 'bg-surface-2 text-text-dim'
                        }`}
                      >
                        {schedule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggle(schedule)}
                        className="mr-3 text-xs font-medium text-red-brand hover:underline"
                      >
                        {schedule.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(schedule)}
                        className="text-xs font-medium text-status-red hover:underline"
                      >
                        Supprimer
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </motion.section>

      <motion.section
        variants={sectionVariants}
        initial={initialOrNone(reduce)}
        animate="visible"
        transition={{ delay: reduce ? 0 : 0.08 }}
      >
        <h2 className="mb-3 font-display text-xl text-text">Historique</h2>
        {runs.length === 0 ? (
          <EmptyState
            title="Historique vide"
            detail={
              runsMeta.emptyReasonFr ??
              "Aucun processus de sauvegarde ne tourne : cet historique est vide parce que rien ne l'alimente."
            }
            muted
          />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                  <th className="px-4 py-3 font-medium">Planification</th>
                  <th className="px-4 py-3 font-medium">Démarrée</th>
                  <th className="px-4 py-3 font-medium">Terminée</th>
                  <th className="px-4 py-3 font-medium">Taille</th>
                  <th className="px-4 py-3 font-medium">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text">{run.schedule?.labelFr ?? '—'}</td>
                    <td className="px-4 py-3 text-text-dim">
                      {new Date(run.startedAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {run.finishedAt ? new Date(run.finishedAt).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-dim">{formatSize(run.sizeBytes)}</td>
                    <td className="px-4 py-3">
                      <span className={run.ok ? 'text-status-green' : 'text-status-red'}>
                        {run.ok ? 'Succès' : 'Échec'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>

      {error && <p className="mt-4 text-sm text-status-red">{error}</p>}
    </div>
  );
}
