import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { questsApi } from '../../../api/quests.js';
import Avatar from '../../../components/me/Avatar.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';
const fieldClass =
  'w-full rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /app/manager/quests — additional manager page (not in the PDF route guide; added on
 * request). Ad-hoc tasks a manager assigns to any direct report, independent of onboarding
 * (see server/prisma/migrations/20260906090000_manager_quests). Unlike "assign a task"
 * (/app/manager/recruits/:id/tasks/new), which only exists for a recruit with an active
 * onboarding instance, a quest works for any of the manager's reports at any time — the
 * manager assigns and can edit/cancel; only the assignee marks it done or reopens it.
 */
export default function ManagerQuestsPage() {
  const { t, i18n } = useTranslation();
  const [quests, setQuests] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const reduce = useReducedMotion();

  async function load() {
    try {
      const [questsRes, reportsRes] = await Promise.all([questsApi.list(), questsApi.assignable()]);
      setQuests(questsRes.data);
      setReports(reportsRes.data);
    } catch {
      setError(t('manager.quests.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <PageLoading label={t('manager.quests.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('manager.quests.title')}
        subtitle={t('manager.quests.subtitle')}
        actions={
          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            className="rounded-app bg-red-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-red-light"
          >
            {formOpen ? t('common.actions.close') : t('manager.quests.newQuest')}
          </button>
        }
      />

      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <QuestForm
              reports={reports}
              onCreated={async () => {
                setFormOpen(false);
                await load();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {quests.length === 0 ? (
        <EmptyState detail={t('manager.quests.empty')} muted />
      ) : (
        <motion.ul
          variants={staggerContainer(0.05)}
          initial={initialOrNone(reduce)}
          animate="visible"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {quests.map((quest) => (
            <motion.li key={quest.id} variants={staggerItem} className={`${CARD} p-4`}>
              <div className="flex items-start gap-3">
                <Avatar name={quest.assignee.displayName} url={quest.assignee.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-text-dim">{quest.assignee.displayName}</p>
                  <p className="mt-0.5 font-medium text-text">{quest.titleFr}</p>
                  {quest.detailFr && <p className="mt-1 text-xs text-text-dim">{quest.detailFr}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        quest.status === 'DONE'
                          ? 'bg-status-green/10 text-status-green'
                          : 'bg-surface-2 text-text-dim',
                      )}
                    >
                      {quest.status === 'DONE' ? t('manager.quests.status.done') : t('manager.quests.status.todo')}
                    </span>
                    {quest.dueDate && (
                      <span className="text-xs text-text-dim">
                        {new Date(quest.dueDate).toLocaleDateString(localeOf(i18n))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}

function QuestForm({ reports, onCreated }) {
  const { t } = useTranslation();
  const [assigneeId, setAssigneeId] = useState(reports[0]?.id ?? '');
  const [titleFr, setTitleFr] = useState('');
  const [detailFr, setDetailFr] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!assigneeId) return;
    setSubmitting(true);
    setError(null);
    try {
      await questsApi.create({ assigneeId, titleFr, detailFr: detailFr || undefined, dueDate: dueDate || null });
      setTitleFr('');
      setDetailFr('');
      setDueDate('');
      await onCreated();
    } catch {
      setError(t('manager.quests.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (reports.length === 0) {
    return (
      <div className={`${CARD} p-4`}>
        <EmptyState detail={t('manager.quests.noReports')} muted />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD} space-y-3 p-4`}>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">{t('manager.quests.assignTo')}</label>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={fieldClass}>
          {reports.map((report) => (
            <option key={report.id} value={report.id}>
              {report.displayName}
              {report.positionTitleFr ? ` — ${report.positionTitleFr}` : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">{t('common.labels.title')}</label>
        <input
          type="text"
          required
          value={titleFr}
          onChange={(e) => setTitleFr(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">{t('common.labels.description')}</label>
        <textarea value={detailFr} onChange={(e) => setDetailFr(e.target.value)} rows={3} className={fieldClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-text">{t('common.labels.dueDate')}</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`${fieldClass} max-w-[220px]`}
        />
      </div>
      {error && <p className="text-sm text-status-red">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || titleFr.trim().length < 2}
          className="rounded-app bg-red-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-red-light disabled:opacity-60"
        >
          {submitting ? t('common.states.sending') : t('manager.quests.submit')}
        </button>
      </div>
    </form>
  );
}
