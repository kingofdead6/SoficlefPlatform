import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { questsApi } from '../../../api/quests.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';
import { localeOf } from '../../../lib/formatDate.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

/**
 * /app/me/quests — additional employee page (not in the PDF route guide; added on request).
 * Ad-hoc tasks the caller's manager has assigned them (see quest:read SELF-scoped in
 * permissions.js), independent of onboarding. Only the assignee may toggle status — the
 * manager's own view of the same quests (/app/manager/quests) is read-only on that point.
 */
export default function MeQuestsPage() {
  const { t, i18n } = useTranslation();
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const reduce = useReducedMotion();

  async function load() {
    try {
      const { data } = await questsApi.list();
      setQuests(data);
    } catch {
      setError(t('me.quests.loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(quest) {
    setPendingId(quest.id);
    try {
      const nextStatus = quest.status === 'DONE' ? 'TODO' : 'DONE';
      const { data } = await questsApi.setStatus(quest.id, nextStatus);
      setQuests((current) => current.map((item) => (item.id === quest.id ? data : item)));
    } catch {
      // The list stays as it was; the toggle simply did not take. No error state is
      // surfaced for a single row failing — the next successful load will reconcile it.
    } finally {
      setPendingId(null);
    }
  }

  if (loading) return <PageLoading label={t('me.quests.loading')} />;
  if (error) return <PageError message={error} />;

  const open = quests.filter((quest) => quest.status !== 'DONE');
  const done = quests.filter((quest) => quest.status === 'DONE');

  return (
    <div>
      <PageHeader eyebrow={t('me.eyebrow')} title={t('me.quests.title')} subtitle={t('me.quests.subtitle')} />

      {quests.length === 0 ? (
        <EmptyState detail={t('me.quests.empty')} muted />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-lg text-text">{t('me.quests.openHeading', { count: open.length })}</h2>
            {open.length === 0 ? (
              <EmptyState detail={t('me.quests.noneOpen')} muted />
            ) : (
              <motion.ul
                variants={staggerContainer(0.05)}
                initial={initialOrNone(reduce)}
                animate="visible"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {open.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    pending={pendingId === quest.id}
                    onToggle={() => toggle(quest)}
                    locale={localeOf(i18n)}
                  />
                ))}
              </motion.ul>
            )}
          </section>

          {done.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-lg text-text">{t('me.quests.doneHeading', { count: done.length })}</h2>
              <motion.ul
                variants={staggerContainer(0.05)}
                initial={initialOrNone(reduce)}
                animate="visible"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {done.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    pending={pendingId === quest.id}
                    onToggle={() => toggle(quest)}
                    locale={localeOf(i18n)}
                  />
                ))}
              </motion.ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function QuestCard({ quest, pending, onToggle, locale }) {
  const { t } = useTranslation();
  const done = quest.status === 'DONE';

  return (
    <motion.li variants={staggerItem} className={cn(CARD, 'p-4', done && 'opacity-70')}>
      <p className={cn('font-medium text-text', done && 'line-through')}>{quest.titleFr}</p>
      {quest.detailFr && <p className="mt-1 text-xs text-text-dim">{quest.detailFr}</p>}
      <p className="mt-2 text-xs text-text-dim">{t('me.quests.assignedBy', { name: quest.createdBy.displayName })}</p>
      {quest.dueDate && (
        <p className="mt-1 text-xs text-text-dim">{new Date(quest.dueDate).toLocaleDateString(locale)}</p>
      )}
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={cn(
          'mt-3 w-full rounded-app border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
          done
            ? 'border-border text-text-dim hover:border-red-brand hover:text-red-brand'
            : 'border-status-green/40 bg-status-green/10 text-status-green hover:bg-status-green/20',
        )}
      >
        {done ? t('me.quests.reopen') : t('me.quests.markDone')}
      </button>
    </motion.li>
  );
}
