import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { trainingApi } from '../../../api/training.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { useAuth } from '../../../auth/AuthContext.jsx';
import { can } from '../../../lib/permissions.js';
import { staggerContainer, staggerItem, cardHover, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const EMPTY_FORM = {
  code: '',
  titleFr: '',
  summaryFr: '',
  contentFr: '',
  isMandatory: true,
  passingScore: 70,
  order: 0,
};

/**
 * /app/hr/training (route guide §2.3, SITE).
 * "Training catalogue: create modules, set which are mandatory."
 *
 * The catalogue and the coverage figures are real reads (GET /training, /training/coverage).
 *
 * HR holds `training:read` only — the catalogue gives `training:create`/`:update` to ADMIN.
 * The creation form is therefore rendered only for a caller who holds `training:create`, and
 * the mandatory flag is set at creation (there is no module-update endpoint in
 * training.routes.js, so toggling an existing module's mandatory flag is not offered rather
 * than offered and broken).
 */
export default function HrTrainingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [catalogue, setCatalogue] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const reduce = useReducedMotion();

  const canCreate = can(user, 'create', 'training');
  const canEditQuiz = can(user, 'update', 'training');

  const load = useCallback(async () => {
    try {
      const [catalogueRes, coverageRes] = await Promise.all([
        trainingApi.catalogue(),
        trainingApi.coverage().catch(() => ({ data: null })),
      ]);
      setCatalogue(catalogueRes.data);
      setCoverage(coverageRes.data);
      setError(null);
    } catch {
      setError(t('hr.training.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = catalogue?.entries ?? [];

  const stats = useMemo(
    () => ({
      modules: entries.length,
      mandatory: entries.filter((entry) => entry.isMandatory).length,
      withoutQuiz: entries.filter((entry) => entry.questionCount === 0).length,
    }),
    [entries],
  );

  async function handleCreate(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await trainingApi.createModule({
        code: form.code,
        titleFr: form.titleFr,
        summaryFr: form.summaryFr,
        contentFr: form.contentFr,
        isMandatory: form.isMandatory,
        passingScore: Number(form.passingScore),
        order: Number(form.order) || 0,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? t('hr.training.createError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label={t('hr.training.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.training.title')}
        subtitle={t('hr.training.subtitle')}
        actions={
          canCreate ? (
            <button
              type="button"
              onClick={() => setShowForm((open) => !open)}
              className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
            >
              {showForm ? t('hr.training.cancel') : t('hr.training.newModule')}
            </button>
          ) : null
        }
      />

      {!canCreate && (
        <div className="mb-6 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
          {t('hr.training.readOnlyNotice')} (<code>training:create</code>).
        </div>
      )}

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.training.stats.modules')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.modules} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.training.stats.mandatory')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.mandatory} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.training.stats.withoutQuiz')}
          </p>
          <p
            className={`font-display text-3xl ${stats.withoutQuiz > 0 ? 'text-status-amber' : 'text-red-deep'}`}
          >
            <CountUp value={stats.withoutQuiz} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.training.stats.coverage')}
          </p>
          {coverage?.rate === null || coverage?.rate === undefined ? (
            <p className="font-display text-3xl text-text-dim">—</p>
          ) : (
            <p className="font-display text-3xl text-red-deep">
              <CountUp value={coverage.rate} suffix="%" />
            </p>
          )}
          <p className="mt-1 text-xs text-text-dim">
            {coverage ? t('hr.training.coverage', { trained: coverage.fullyTrained, people: coverage.people }) : '—'}
          </p>
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {showForm && canCreate && (
          <motion.form
            onSubmit={handleCreate}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">{t('hr.training.form.title')}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.training.form.code')}</label>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.training.form.titleLabel')}</label>
                  <input
                    required
                    value={form.titleFr}
                    onChange={(e) => setForm((f) => ({ ...f, titleFr: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">{t('hr.training.form.summary')}</label>
                <textarea
                  required
                  rows={2}
                  value={form.summaryFr}
                  onChange={(e) => setForm((f) => ({ ...f, summaryFr: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text">{t('hr.training.form.content')}</label>
                <textarea
                  required
                  rows={6}
                  value={form.contentFr}
                  onChange={(e) => setForm((f) => ({ ...f, contentFr: e.target.value }))}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={form.isMandatory}
                    onChange={(e) => setForm((f) => ({ ...f, isMandatory: e.target.checked }))}
                    className="accent-[var(--color-red-brand)]"
                  />
                  {t('hr.training.form.mandatory')}
                </label>
                <div className="w-32">
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.training.form.threshold')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.passingScore}
                    onChange={(e) => setForm((f) => ({ ...f, passingScore: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div className="w-24">
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.training.form.order')}</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
              </div>

              {formError && <p className="text-sm text-status-red">{formError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
                >
                  {submitting ? t('hr.training.form.creating') : t('hr.training.form.create')}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {entries.length === 0 ? (
        <EmptyState
          title={t('hr.training.emptyTitle')}
          detail={t('hr.training.emptyDetail')}
          muted
        />
      ) : (
        <motion.div
          variants={staggerContainer(0.05)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {entries.map((entry) => (
            <motion.div key={entry.id} variants={staggerItem} initial="rest" whileHover="hover">
              <motion.div variants={cardHover} className={`${CARD} flex h-full flex-col p-5`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-lg text-text">{entry.titleFr}</p>
                  {entry.isMandatory && (
                    <span className="shrink-0 rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">
                      {t('hr.training.mandatory')}
                    </span>
                  )}
                </div>
                <p className="font-mono text-[10px] text-text-dim">{entry.code}</p>
                <p className="mt-2 flex-1 text-xs text-text-dim">{entry.summaryFr}</p>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className={entry.questionCount === 0 ? 'text-status-amber' : 'text-text-dim'}>
                    {entry.questionCount === 0
                      ? t('hr.training.noQuiz')
                      : t('hr.training.quizSummary', { count: entry.questionCount, score: entry.passingScore })}
                  </span>
                  {canEditQuiz && (
                    <Link
                      to={`/app/hr/training/${entry.code}/quiz`}
                      className="font-medium text-red-brand hover:underline"
                    >
                      {t('hr.training.quiz')} <span aria-hidden className="rtl:-scale-x-100">→</span>
                    </Link>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
