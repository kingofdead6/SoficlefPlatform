import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { alertsApi } from '../../../api/alerts.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const TRIGGER_LABELS = {
  TASK_OVERDUE: 'taskOverdue',
  SURVEY_UNANSWERED: 'surveyUnanswered',
  EVALUATION_DUE: 'evaluationDue',
};

const DEPARTMENT_LABELS = {
  HR: 'HR', IT: 'IT', HSE: 'HSE', QUALITY: 'QUALITY', MANAGER: 'MANAGER', EMPLOYEE: 'EMPLOYEE',
};

const EMPTY_FORM = {
  labelFr: '',
  trigger: 'TASK_OVERDUE',
  thresholdDays: 3,
  notifyDepartment: 'MANAGER',
  escalateAfterDays: '',
  isActive: true,
};

/**
 * /app/hr/alerts (route guide §2.3, SITE).
 * "Rules engine: who gets reminded, after how long, escalation path."
 *
 * Rules genuinely persist, against the `alert_rule` table added for this page (see
 * prisma/migrations/20260902090000_alert_rules). Every write goes through the platform's
 * mutate() pipeline, so each create/edit/delete is validated, authorized and written to the
 * audit log like any other mutation.
 *
 * Scope note stated on the page rather than hidden: these rules define the *policy*. No
 * scheduler runs inside this Express app — there is no cron/worker process in the codebase —
 * so nothing dispatches the reminders on a timer yet. The rules are the configuration a
 * dispatcher will read; claiming they already send mail would be false.
 */
export default function HrAlertsPage() {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const { data } = await alertsApi.rules();
      setRules(data);
      setError(null);
    } catch {
      setError(t('hr.alerts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: rules.length,
      active: rules.filter((rule) => rule.isActive).length,
      escalating: rules.filter((rule) => rule.escalateAfterDays !== null).length,
    }),
    [rules],
  );

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(rule) {
    setEditingId(rule.id);
    setForm({
      labelFr: rule.labelFr,
      trigger: rule.trigger,
      thresholdDays: rule.thresholdDays,
      notifyDepartment: rule.notifyDepartment,
      escalateAfterDays: rule.escalateAfterDays ?? '',
      isActive: rule.isActive,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const payload = {
      labelFr: form.labelFr,
      trigger: form.trigger,
      thresholdDays: Number(form.thresholdDays),
      notifyDepartment: form.notifyDepartment,
      // An empty field means "never escalates" — null, not zero days.
      escalateAfterDays: form.escalateAfterDays === '' ? null : Number(form.escalateAfterDays),
      isActive: form.isActive,
    };

    try {
      if (editingId) await alertsApi.updateRule(editingId, payload);
      else await alertsApi.createRule(payload);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? t('hr.alerts.saveError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(rule) {
    try {
      await alertsApi.updateRule(rule.id, { isActive: !rule.isActive });
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? t('hr.alerts.updateError'));
    }
  }

  async function handleDelete(rule) {
    if (!window.confirm(t('hr.alerts.deleteConfirm', { label: rule.labelFr }))) return;
    try {
      await alertsApi.deleteRule(rule.id);
      await load();
    } catch (err) {
      setFormError(err.body?.message ?? t('hr.alerts.deleteError'));
    }
  }

  if (loading) return <PageLoading label={t('hr.pages.alerts.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.pages.alerts.title')}
        subtitle={t('hr.pages.alerts.subtitle')}
        actions={
          <button
            type="button"
            onClick={showForm ? () => setShowForm(false) : openCreate}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light"
          >
            {showForm ? t('hr.alerts.cancel') : t('hr.alerts.newRule')}
          </button>
        }
      />

      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="mb-6 grid gap-4 sm:grid-cols-3"
      >
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.alerts.stats.total')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.total} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.alerts.stats.active')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.active} />
          </p>
        </motion.div>
        <motion.div variants={staggerItem} className={`${CARD} p-5`}>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
            {t('hr.alerts.stats.escalating')}
          </p>
          <p className="font-display text-3xl text-red-deep">
            <CountUp value={stats.escalating} />
          </p>
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={`${CARD} mb-6 space-y-4 p-6`}>
              <h2 className="font-display text-lg text-text">
                {editingId ? t('hr.alerts.form.editTitle') : t('hr.alerts.form.newTitle')}
              </h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-text">{t('hr.alerts.form.label')}</label>
                <input
                  required
                  placeholder={t('hr.alerts.form.labelPlaceholder')}
                  value={form.labelFr}
                  onChange={(e) => setForm((f) => ({ ...f, labelFr: e.target.value }))}
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">{t('hr.alerts.form.trigger')}</label>
                  <select
                    value={form.trigger}
                    onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                    className={fieldClass}
                  >
                    {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(`hr.alerts.triggers.${label}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    {t('hr.alerts.form.department')}
                  </label>
                  <select
                    value={form.notifyDepartment}
                    onChange={(e) => setForm((f) => ({ ...f, notifyDepartment: e.target.value }))}
                    className={fieldClass}
                  >
                    {Object.entries(DEPARTMENT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(`hr.alerts.departments.${label}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    {t('hr.alerts.form.threshold')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    required
                    value={form.thresholdDays}
                    onChange={(e) => setForm((f) => ({ ...f, thresholdDays: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text">
                    {t('hr.alerts.form.escalation')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    placeholder={t('hr.alerts.form.noEscalation')}
                    value={form.escalateAfterDays}
                    onChange={(e) => setForm((f) => ({ ...f, escalateAfterDays: e.target.value }))}
                    className={fieldClass}
                  />
                  <p className="mt-1 text-xs text-text-dim">
                    {t('hr.alerts.form.escalationHint')}
                  </p>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="accent-[var(--color-red-brand)]"
                />
                {t('hr.alerts.form.active')}
              </label>

              {formError && <p className="text-sm text-status-red">{formError}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-app border border-border px-4 py-2 text-sm font-medium text-text-dim transition hover:bg-surface-2"
                >
                  {t('hr.alerts.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
                >
                  {submitting ? t('hr.alerts.saving') : t('hr.alerts.save')}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {rules.length === 0 ? (
        <EmptyState
          title={t('hr.alerts.emptyTitle')}
          detail={t('hr.alerts.emptyDetail')}
          muted
        />
      ) : (
        <motion.div
          variants={staggerContainer(0.05)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="space-y-3"
        >
          {rules.map((rule) => (
            <motion.div
              key={rule.id}
              variants={staggerItem}
              className={`${CARD} flex flex-wrap items-start gap-4 p-5 ${
                rule.isActive ? '' : 'opacity-60'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-text">{rule.labelFr}</p>
                  <span className="rounded-full bg-red-brand/10 px-2 py-0.5 text-xs font-medium text-red-brand">
                    {TRIGGER_LABELS[rule.trigger] ? t(`hr.alerts.triggers.${TRIGGER_LABELS[rule.trigger]}`) : rule.trigger}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      rule.isActive
                        ? 'bg-status-green/10 text-status-green'
                        : 'bg-surface-2 text-text-dim'
                    }`}
                  >
                    {rule.isActive ? t('hr.alerts.active') : t('hr.alerts.inactive')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-dim">
                  {t('hr.alerts.ruleSummary', { department: DEPARTMENT_LABELS[rule.notifyDepartment] ? t(`hr.alerts.departments.${DEPARTMENT_LABELS[rule.notifyDepartment]}`) : rule.notifyDepartment, days: rule.thresholdDays })}
                  {rule.escalateAfterDays
                    ? ` ${t('hr.alerts.escalationSummary', { days: rule.escalateAfterDays })}`
                    : ` ${t('hr.alerts.noEscalationSummary')}`}
                </p>
              </div>

              <div className="flex shrink-0 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => openEdit(rule)}
                  className="text-red-brand hover:underline"
                >
                  {t('hr.alerts.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggle(rule)}
                  className="text-text-dim hover:text-red-brand hover:underline"
                >
                  {rule.isActive ? t('hr.alerts.disable') : t('hr.alerts.enable')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(rule)}
                  className="text-status-red hover:underline"
                >
                  {t('hr.alerts.delete')}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <p className="mt-8 rounded-app border border-dashed border-border bg-surface-2/60 p-4 text-xs text-text-dim">
        {t('hr.alerts.footerNote')}
      </p>
    </div>
  );
}
