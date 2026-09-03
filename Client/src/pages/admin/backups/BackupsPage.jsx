import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { adminApi } from '../../../api/admin.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const field =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const EMPTY_FORM = { labelFr: '', cronFr: '', retentionDays: 30, isActive: true };

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const value = Number(bytes);
  if (!Number.isFinite(value)) return String(bytes);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
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
  const { t, i18n } = useTranslation();
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
      setError(t('admin.backups.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(t('admin.backups.schedules.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  async function toggle(schedule) {
    try {
      await adminApi.updateBackupSchedule(schedule.id, { isActive: !schedule.isActive });
      await load();
    } catch {
      setError(t('admin.backups.schedules.updateFailed'));
    }
  }

  async function remove(schedule) {
    if (!window.confirm(t('admin.backups.schedules.confirmDelete', { label: schedule.labelFr }))) return;
    try {
      await adminApi.deleteBackupSchedule(schedule.id);
      await load();
    } catch {
      setError(t('admin.backups.schedules.deleteFailed'));
    }
  }

  if (loading) return <PageLoading label={t('admin.backups.loading')} />;
  if (error && !report) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('admin.backups.eyebrow')}
        title={t('admin.backups.title')}
        subtitle={t('admin.backups.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
          >
            {showForm ? t('admin.backups.cancel') : t('admin.backups.newSchedule')}
          </button>
        }
      />

      <div className="mb-8 rounded-app border border-red-brand/40 bg-red-brand/5 p-4 text-sm text-text-dim">
        <p className="font-medium text-text">{t('admin.backups.noExecutor.title')}</p>
        <p className="mt-1">{t('admin.backups.noExecutor.body')}</p>
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
                <span className="mb-1 block text-sm font-medium text-text">{t('admin.backups.form.label')}</span>
                <input
                  required
                  value={form.labelFr}
                  onChange={(e) => setForm((prev) => ({ ...prev, labelFr: e.target.value }))}
                  placeholder={t('admin.backups.form.labelPlaceholder')}
                  className={`${field} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text">{t('admin.backups.form.frequency')}</span>
                <input
                  required
                  value={form.cronFr}
                  onChange={(e) => setForm((prev) => ({ ...prev, cronFr: e.target.value }))}
                  placeholder={t('admin.backups.form.frequencyPlaceholder')}
                  className={`${field} w-full`}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text">{t('admin.backups.form.retentionDays')}</span>
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
                  {creating ? t('admin.backups.form.creating') : t('admin.backups.form.create')}
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
        <h2 className="mb-3 font-display text-xl text-text">{t('admin.backups.schedules.title', { count: schedules.length })}</h2>
        {schedules.length === 0 ? (
          <EmptyState detail={t('admin.backups.schedules.empty')} />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                  <th className="px-4 py-3 font-medium">{t('admin.backups.schedules.label')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.backups.schedules.frequency')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.backups.schedules.retention')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.backups.schedules.state')}</th>
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
                    <td className="px-4 py-3 text-text-dim">
                      {t('admin.backups.schedules.retentionDays', { count: schedule.retentionDays })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          schedule.isActive
                            ? 'bg-status-green/10 text-status-green'
                            : 'bg-surface-2 text-text-dim'
                        }`}
                      >
                        {schedule.isActive ? t('admin.backups.schedules.active') : t('admin.backups.schedules.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button
                        type="button"
                        onClick={() => toggle(schedule)}
                        className="me-3 text-xs font-medium text-red-brand hover:underline"
                      >
                        {schedule.isActive ? t('admin.backups.schedules.deactivate') : t('admin.backups.schedules.activate')}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(schedule)}
                        className="text-xs font-medium text-status-red hover:underline"
                      >
                        {t('admin.backups.schedules.delete')}
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
        <h2 className="mb-3 font-display text-xl text-text">{t('admin.backups.history.title')}</h2>
        {runs.length === 0 ? (
          <EmptyState
            title={t('admin.backups.history.empty')}
            detail={runsMeta.emptyReasonFr ?? t('admin.backups.history.emptyDetail')}
            muted
          />
        ) : (
          <div className={`overflow-hidden ${CARD}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                  <th className="px-4 py-3 font-medium">{t('admin.backups.history.schedule')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.backups.history.started')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.backups.history.finished')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.backups.history.size')}</th>
                  <th className="px-4 py-3 font-medium">{t('admin.backups.history.result')}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text">{run.schedule?.labelFr ?? '—'}</td>
                    <td className="px-4 py-3 text-text-dim">
                      {new Date(run.startedAt).toLocaleString(localeOf(i18n))}
                    </td>
                    <td className="px-4 py-3 text-text-dim">
                      {run.finishedAt ? new Date(run.finishedAt).toLocaleString(localeOf(i18n)) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-dim">{formatSize(run.sizeBytes)}</td>
                    <td className="px-4 py-3">
                      <span className={run.ok ? 'text-status-green' : 'text-status-red'}>
                        {run.ok ? t('admin.backups.history.success') : t('admin.backups.history.failure')}
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
