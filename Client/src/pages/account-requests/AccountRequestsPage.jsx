import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { accountRequestsApi } from '../../api/account-requests.js';
import { ApiError } from '../../api/client.js';

/** API statuses → catalogue keys + styling. The status values come from the server. */
const STATUS_META = {
  OPEN: { labelKey: 'accountRequests.status.open', className: 'bg-red-brand/10 text-red-brand' },
  CREATED: { labelKey: 'accountRequests.status.created', className: 'bg-green-600/10 text-green-700' },
  REJECTED: { labelKey: 'accountRequests.status.rejected', className: 'bg-text-dim/10 text-text-dim' },
};

/** API urgency values → catalogue keys. The values are submitted to the server as-is. */
const URGENCY_LABEL_KEYS = {
  NORMAL: 'accountRequests.urgency.normal',
  URGENT: 'accountRequests.urgency.urgent',
};

const EMPTY_FORM = {
  candidateNameFr: '',
  plannedPositionFr: '',
  plannedHireDate: '',
  urgency: 'NORMAL',
  noteFr: '',
};

/**
 * HR asking SI to create an account — the first hop of the provisioning chain
 * (CDC-2026 Module 1). Ported from app/actions/account-requests.ts and the
 * `listAccountRequests` read in application/organization/assignments.ts.
 */
export default function AccountRequestsPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await accountRequestsApi.list();
      setRequests(data ?? []);
    } catch {
      setError(t('accountRequests.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await accountRequestsApi.create({
        candidateNameFr: form.candidateNameFr,
        plannedPositionFr: form.plannedPositionFr,
        plannedHireDate: form.plannedHireDate || null,
        urgency: form.urgency,
        noteFr: form.noteFr || undefined,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.body?.fieldErrors) {
        setFormError(t('accountRequests.formFieldError'));
      } else {
        setFormError(t('accountRequests.saveFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-red-deep">{t('accountRequests.title')}</h1>
        <p className="text-text-dim mt-1 text-sm">{t('accountRequests.intro')}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-app border border-border bg-surface p-4 space-y-4"
      >
        <h2 className="text-sm font-medium text-text">{t('accountRequests.newRequest')}</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">{t('accountRequests.fields.candidateName')}</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.candidateNameFr}
              onChange={(e) => setForm((f) => ({ ...f, candidateNameFr: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">{t('accountRequests.fields.plannedPosition')}</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={form.plannedPositionFr}
              onChange={(e) => setForm((f) => ({ ...f, plannedPositionFr: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">{t('accountRequests.fields.plannedHireDate')}</span>
            <input
              type="date"
              value={form.plannedHireDate}
              onChange={(e) => setForm((f) => ({ ...f, plannedHireDate: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="text-text-dim mb-1 block">{t('accountRequests.fields.urgency')}</span>
            <select
              value={form.urgency}
              onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
              className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            >
              <option value="NORMAL">{t('accountRequests.urgency.normal')}</option>
              <option value="URGENT">{t('accountRequests.urgency.urgent')}</option>
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-text-dim mb-1 block">{t('accountRequests.fields.note')}</span>
          <textarea
            maxLength={1000}
            value={form.noteFr}
            onChange={(e) => setForm((f) => ({ ...f, noteFr: e.target.value }))}
            className="rounded-app border border-border w-full px-2 py-1.5 text-sm"
            rows={3}
          />
        </label>

        {formError && <p className="text-sm text-red-brand">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
        >
          {submitting ? t('common.states.sending') : t('accountRequests.submit')}
        </button>
      </form>

      <section>
        <h2 className="mb-2 text-sm font-medium text-text">{t('accountRequests.openRequests')}</h2>
        {loading ? (
          <p className="text-text-dim text-sm">{t('common.states.loading')}</p>
        ) : error ? (
          <p className="text-sm text-red-brand">{error}</p>
        ) : requests.length === 0 ? (
          <p className="text-text-dim text-sm">{t('accountRequests.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-app border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border border-b text-left text-text-dim">
                  <th className="px-3 py-2 font-medium">{t('accountRequests.columns.candidate')}</th>
                  <th className="px-3 py-2 font-medium">{t('common.labels.position')}</th>
                  <th className="px-3 py-2 font-medium">{t('accountRequests.fields.urgency')}</th>
                  <th className="px-3 py-2 font-medium">{t('common.labels.status')}</th>
                  <th className="px-3 py-2 font-medium">{t('accountRequests.columns.waiting')}</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-3 py-2 text-text">{request.candidateNameFr}</td>
                    <td className="px-3 py-2 text-text">{request.plannedPositionFr}</td>
                    <td className="px-3 py-2 text-text-dim">
                      {URGENCY_LABEL_KEYS[request.urgency] ? t(URGENCY_LABEL_KEYS[request.urgency]) : request.urgency}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-app px-2 py-0.5 text-xs font-medium ${
                          STATUS_META[request.status]?.className ?? 'bg-text-dim/10 text-text-dim'
                        }`}
                      >
                        {STATUS_META[request.status] ? t(STATUS_META[request.status].labelKey) : request.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text-dim">
                      {t('accountRequests.waitingDays', { count: request.waitingDays })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
