import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { jobDescriptionsApi } from '../../api/jobDescriptions.js';
import { formatDateTime } from '../../lib/formatDate.js';

/** API statuses → catalogue keys. The status values themselves come from the server. */
const STATUS_LABEL_KEYS = {
  DRAFT: 'jobDescription.status.draft',
  IN_REVIEW: 'jobDescription.status.inReview',
  CHANGES_REQUESTED: 'jobDescription.status.changesRequested',
  VALIDATED: 'jobDescription.status.validated',
  ARCHIVED: 'jobDescription.status.archived',
};

/** API action names → catalogue keys. The action names are sent back to the server as-is. */
const ACTION_LABEL_KEYS = {
  submit: 'jobDescription.actions.submit',
  approve: 'jobDescription.actions.approve',
  request_changes: 'jobDescription.actions.requestChanges',
  archive: 'jobDescription.actions.archive',
  reopen: 'jobDescription.actions.reopen',
};

export default function JobDescriptionDossierPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentFr, setCommentFr] = useState('');
  const [reasonFr, setReasonFr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await jobDescriptionsApi.dossier(id);
      setDossier(data);
    } catch {
      setError(t('jobDescription.notFound'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function applyAction(versionId, action) {
    setBusy(true);
    setError(null);
    try {
      await jobDescriptionsApi.applyAction({ versionId, action, commentFr });
      setCommentFr('');
      await load();
    } catch {
      setError(t('jobDescription.actionFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    if (!reasonFr.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await jobDescriptionsApi.createDraft({ jobDescriptionId: id, reasonFr });
      setReasonFr('');
      await load();
    } catch {
      setError(t('jobDescription.createDraftFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-text-dim">{t('common.states.loading')}</div>;
  if (error && !dossier) return <div className="p-6 text-status-red">{error}</div>;
  if (!dossier) return null;

  const current = dossier.versions.find((v) => v.id === dossier.currentVersionId);

  return (
    <div>
      <Link to="/job-description" className="mb-4 inline-block text-sm text-red-brand hover:underline">
        {t('jobDescription.backToList')}
      </Link>
      <h1 className="mb-1 font-display text-2xl text-red-deep">{dossier.jobTitleFr}</h1>
      <p className="mb-6 text-text-dim">{t('jobDescription.codeLabel', { code: dossier.code })}</p>

      {error && <p className="mb-4 text-sm text-status-red">{error}</p>}

      {current && (
        <div className="mb-6 rounded-app border border-border bg-surface p-4 shadow-app">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-text">
              {t('jobDescription.currentVersion', { number: current.versionNumber })}
            </h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
              {STATUS_LABEL_KEYS[current.status] ? t(STATUS_LABEL_KEYS[current.status]) : current.status}
            </span>
          </div>

          {current.actions.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <textarea
                placeholder={t('jobDescription.commentPlaceholder')}
                value={commentFr}
                onChange={(e) => setCommentFr(e.target.value)}
                rows={2}
                className="w-full rounded-app border border-border px-3 py-2 text-sm outline-none focus:border-red-brand"
              />
              <div className="flex flex-wrap gap-2">
                {current.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={busy}
                    onClick={() => applyAction(current.id, action)}
                    className="rounded-app border border-border px-3 py-1.5 text-sm font-medium text-text hover:border-red-brand hover:text-red-brand disabled:opacity-50"
                  >
                    {ACTION_LABEL_KEYS[action] ? t(ACTION_LABEL_KEYS[action]) : action}
                  </button>
                ))}
              </div>
            </div>
          )}

          {current.status === 'VALIDATED' && (
            <div className="mt-4 space-y-2 border-t border-border pt-3">
              <p className="text-xs text-text-muted">{t('jobDescription.createVersionNote')}</p>
              <input
                type="text"
                placeholder={t('jobDescription.reasonPlaceholder')}
                value={reasonFr}
                onChange={(e) => setReasonFr(e.target.value)}
                className="w-full rounded-app border border-border px-3 py-2 text-sm outline-none focus:border-red-brand"
              />
              <button
                type="button"
                disabled={busy}
                onClick={createDraft}
                className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white hover:bg-red-light disabled:opacity-60"
              >
                {t('jobDescription.createDraft')}
              </button>
            </div>
          )}
        </div>
      )}

      <section className="mb-6 rounded-app border border-border bg-surface p-4 shadow-app">
        <h2 className="mb-3 font-medium text-text">{t('jobDescription.versionHistory')}</h2>
        <ul className="space-y-2 text-sm">
          {dossier.versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between">
              <span className="text-text-dim">
                v{version.versionNumber} — {version.reasonFr ?? t('jobDescription.initialVersion')}
              </span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-dim">
                {STATUS_LABEL_KEYS[version.status] ? t(STATUS_LABEL_KEYS[version.status]) : version.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-app border border-border bg-surface p-4 shadow-app">
        <h2 className="mb-3 font-medium text-text">{t('jobDescription.actionLog')}</h2>
        <ul className="space-y-2 text-sm">
          {dossier.trail.map((entry) => (
            <li key={entry.id} className="text-text-dim">
              {formatDateTime(entry.createdAt, i18n)} — {entry.actorName ?? t('jobDescription.systemActor')} : {entry.action}
              {entry.fromStatus && entry.toStatus && ` (${entry.fromStatus} → ${entry.toStatus})`}
            </li>
          ))}
          {dossier.trail.length === 0 && <p className="text-text-dim">{t('jobDescription.noActions')}</p>}
        </ul>
      </section>
    </div>
  );
}
