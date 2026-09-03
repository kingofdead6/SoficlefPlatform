import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { onboardingApi } from '../../api/onboarding.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { localeOf } from '../../lib/formatDate.js';

/** The new arrival's welcome / overview page — greeting, progress, next steps, contacts. */
export default function WelcomePage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Hooks run before the loading guard below, or the hook order changes between renders.
  const { t, i18n } = useTranslation();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await onboardingApi.meOverview();
        setOverview(data);
      } catch {
        setError('load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-6 text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="p-6 text-status-red">{t('me.welcome.loadFailed')}</div>;
  if (!overview) return null;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">
        {t('me.welcome.greeting', { name: user?.displayName })}
      </h1>
      <p className="mb-6 text-text-dim">
        {overview.dayNumber === null
          ? t('me.welcome.notStarted')
          : t('me.welcome.dayNumber', { count: overview.dayNumber })}
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-app border border-border bg-surface p-4 shadow-app">
          <h2 className="mb-2 font-medium text-text">{t('me.welcome.progress.title')}</h2>
          <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-red-brand" style={{ width: `${overview.progress.percent}%` }} />
          </div>
          <p className="text-sm text-text-dim">
            {t('me.welcome.progress.steps', {
              done: overview.progress.done,
              total: overview.progress.total,
            })}
          </p>
        </div>

        <div className="rounded-app border border-border bg-surface p-4 shadow-app">
          <h2 className="mb-2 font-medium text-text">{t('me.welcome.contacts.title')}</h2>
          {overview.manager && (
            <p className="text-sm text-text-dim">
              {t('me.welcome.contacts.manager', {
                name: overview.manager.displayName,
                email: overview.manager.email,
              })}
            </p>
          )}
          {overview.hrContact && (
            <p className="text-sm text-text-dim">
              {t('me.welcome.contacts.hr', {
                name: overview.hrContact.nameFr,
                extension: overview.hrContact.extension,
              })}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-app border border-border bg-surface p-4 shadow-app">
        <h2 className="mb-3 font-medium text-text">{t('me.welcome.nextTasks.title')}</h2>
        <ul className="space-y-2 text-sm">
          {overview.nextTasks.map((task) => (
            <li key={task.milestoneId} className="text-text-dim">
              {task.titleFr}
              {task.dueDate &&
                t('me.welcome.nextTasks.due', {
                  date: new Date(task.dueDate).toLocaleDateString(localeOf(i18n)),
                })}
            </li>
          ))}
          {overview.nextTasks.length === 0 && (
            <p className="text-text-dim">{t('me.welcome.nextTasks.empty')}</p>
          )}
        </ul>
      </div>
    </div>
  );
}
