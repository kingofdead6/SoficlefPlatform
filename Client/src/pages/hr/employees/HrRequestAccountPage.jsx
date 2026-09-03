import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { accountRequestsApi } from '../../../api/account-requests.js';
import { ApiError } from '../../../api/client.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, rowVariants, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

const STATUS_LABELS = {
  OPEN: { key: 'open', className: 'bg-red-brand/10 text-red-brand' },
  CREATED: { key: 'created', className: 'bg-status-green/10 text-status-green' },
  REJECTED: { key: 'rejected', className: 'bg-surface-2 text-text-dim' },
};

const EMPTY_FORM = {
  candidateNameFr: '',
  plannedPositionFr: '',
  plannedHireDate: '',
  urgency: 'NORMAL',
  noteFr: '',
};

/**
 * /app/hr/employees/request (route guide §2.3, CORE).
 * "Request account → opens an SI ticket (candidate name, planned position, planned hire
 * date, urgency)."
 *
 * HR deliberately holds no `user:create`: this records a request that SI acts on, which is
 * exactly what POST /account-requests does. The list below is the same request log, so HR
 * can see what is still open rather than re-sending a ticket that already exists.
 */
export default function HrRequestAccountPage() {
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const reduce = useReducedMotion();

  const load = useCallback(async () => {
    try {
      const { data } = await accountRequestsApi.list();
      setRequests(data ?? []);
      setError(null);
    } catch {
      setError(t('hr.accountRequests.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setConfirmation(null);
    try {
      await accountRequestsApi.create({
        candidateNameFr: form.candidateNameFr,
        plannedPositionFr: form.plannedPositionFr,
        plannedHireDate: form.plannedHireDate || null,
        urgency: form.urgency,
        noteFr: form.noteFr || undefined,
      });
      setConfirmation(t('hr.accountRequests.confirmation', { name: form.candidateNameFr }));
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.body?.fieldErrors
          ? t('hr.accountRequests.validationError')
          : t('hr.accountRequests.saveError'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label={t('hr.accountRequests.loading')} />;
  if (error && requests.length === 0) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.accountRequests.title')}
        subtitle={t('hr.accountRequests.subtitle')}
      />

      <div className="grid gap-8 lg:grid-cols-5">
        <motion.form
          onSubmit={handleSubmit}
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          className={`${CARD} space-y-4 p-6 lg:col-span-2`}
        >
          <h2 className="font-display text-lg text-text">{t('hr.accountRequests.form.title')}</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('hr.accountRequests.form.candidate')}</label>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.candidateNameFr}
              onChange={(e) => setForm((f) => ({ ...f, candidateNameFr: e.target.value }))}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('hr.accountRequests.form.position')}</label>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.plannedPositionFr}
              onChange={(e) => setForm((f) => ({ ...f, plannedPositionFr: e.target.value }))}
              className={fieldClass}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">{t('hr.accountRequests.form.hireDate')}</label>
              <input
                type="date"
                value={form.plannedHireDate}
                onChange={(e) => setForm((f) => ({ ...f, plannedHireDate: e.target.value }))}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">{t('hr.accountRequests.form.urgency')}</label>
              <select
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                className={fieldClass}
              >
                <option value="NORMAL">{t('hr.accountRequests.urgency.normal')}</option>
                <option value="URGENT">{t('hr.accountRequests.urgency.urgent')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text">{t('hr.accountRequests.form.note')}</label>
            <textarea
              maxLength={1000}
              rows={3}
              value={form.noteFr}
              onChange={(e) => setForm((f) => ({ ...f, noteFr: e.target.value }))}
              className={fieldClass}
            />
          </div>

          <AnimatePresence>
            {formError && (
              <motion.p
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-status-red"
              >
                {formError}
              </motion.p>
            )}
            {confirmation && (
              <motion.p
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-sm text-status-green"
              >
                {confirmation}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={submitting}
            whileHover={reduce || submitting ? undefined : { scale: 1.02 }}
            whileTap={reduce || submitting ? undefined : { scale: 0.98 }}
            className="w-full rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-light disabled:opacity-60"
          >
            {submitting ? t('hr.accountRequests.form.sending') : t('hr.accountRequests.form.submit')}
          </motion.button>
        </motion.form>

        <section className="lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg text-text">{t('hr.accountRequests.list.title')}</h2>
            <span className="text-sm text-text-dim">{requests.length}</span>
          </div>

          {requests.length === 0 ? (
            <EmptyState detail={t('hr.accountRequests.list.empty')} muted />
          ) : (
            <div className={`overflow-hidden ${CARD}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-left text-text-muted">
                    <th className="px-4 py-3 font-medium">{t('hr.accountRequests.table.candidate')}</th>
                    <th className="px-4 py-3 font-medium">{t('hr.accountRequests.table.position')}</th>
                    <th className="px-4 py-3 font-medium">{t('hr.accountRequests.table.urgency')}</th>
                    <th className="px-4 py-3 font-medium">{t('hr.accountRequests.table.status')}</th>
                    <th className="px-4 py-3 font-medium">{t('hr.accountRequests.table.waiting')}</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={staggerContainer(0.04, 0.2)}
                  initial={initialOrNone(reduce)}
                  animate="visible"
                >
                  {requests.map((request) => (
                    <motion.tr
                      key={request.id}
                      variants={rowVariants}
                      className="border-b border-border last:border-0 hover:bg-surface-2/60"
                    >
                      <td className="px-4 py-3 font-medium text-text">{request.candidateNameFr}</td>
                      <td className="px-4 py-3 text-text-dim">{request.plannedPositionFr}</td>
                      <td className="px-4 py-3 text-text-dim">
                        {t(`hr.accountRequests.urgency.${request.urgency.toLowerCase()}`, request.urgency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_LABELS[request.status]?.className ?? 'bg-surface-2 text-text-dim'
                          }`}
                        >
                          {STATUS_LABELS[request.status]
                            ? t(`hr.accountRequests.status.${STATUS_LABELS[request.status].key}`)
                            : request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-dim">{t('hr.accountRequests.days', { count: request.waitingDays })}</td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
