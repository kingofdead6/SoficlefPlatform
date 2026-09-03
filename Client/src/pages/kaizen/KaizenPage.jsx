import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { kaizenApi } from '../../api/kaizen.js';
import { ApiError } from '../../api/client.js';

/**
 * The Kaizen programme — missions, results, journal, gaps, action plan — ported from
 * SoficlefPlatform's app/[locale]/(app)/kaizen/page.tsx. mayEdit (from the API, mirroring
 * `can(user, 'update', 'kaizen_action')`) gates the status dropdown on each action row.
 */
export default function KaizenPage() {
  const { t } = useTranslation();
  const [programme, setProgramme] = useState(null);
  const [mayEdit, setMayEdit] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([kaizenApi.programme(), kaizenApi.statuses()])
      .then(([prog, stat]) => {
        setProgramme(prog.data);
        setMayEdit(prog.mayEdit);
        setStatuses(stat.data);
        setActiveMissionId(prog.data?.missions?.[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  async function handleStatusChange(actionId, statusFr) {
    try {
      await kaizenApi.setActionStatus(actionId, statusFr);
      setProgramme((prev) => ({
        ...prev,
        missions: prev.missions.map((mission) => ({
          ...mission,
          actions: mission.actions.map((action) =>
            action.id === actionId ? { ...action, statusFr } : action,
          ),
        })),
      }));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : t('kaizen.statusUpdateFailed'));
    }
  }

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!programme) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('kaizen.unavailable')}
      </div>
    );
  }

  const activeMission = programme.missions.find((mission) => mission.id === activeMissionId);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">{t('kaizen.title')}</h1>

      <div className="rounded-app border border-red-brand/30 bg-surface p-5 shadow-app">
        <h2 className="font-display text-lg text-text">
          {t('kaizen.internalLead', { value: programme.internalLeadFr })}
        </h2>
        <p className="mt-1 text-[13.5px] text-text">{programme.programmeFr}</p>
      </div>

      {programme.missions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">{t('kaizen.missions')}</h3>
          <div className="flex flex-wrap gap-2 border-b border-border pb-3">
            {programme.missions.map((mission) => (
              <button
                key={mission.id}
                onClick={() => setActiveMissionId(mission.id)}
                className={`rounded-app px-3 py-1.5 text-[13px] ${
                  mission.id === activeMissionId
                    ? 'bg-red-brand text-white'
                    : 'bg-surface-2 text-text-dim hover:text-text'
                }`}
              >
                {mission.icon ?? ''} {t('kaizen.missionNumber', { number: mission.number })}
              </button>
            ))}
          </div>

          {activeMission && (
            <MissionPanel mission={activeMission} mayEdit={mayEdit} statuses={statuses} onStatusChange={handleStatusChange} />
          )}
        </section>
      )}

      {programme.priorityActionsJ30.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('kaizen.priorityActions')}
          </h3>
          <ol className="space-y-2">
            {programme.priorityActionsJ30.map((action) => (
              <li key={action.id} className="rounded-app border border-border bg-surface p-3 text-[13px] shadow-app">
                <span className="me-2 font-mono text-text-dim">{action.dayLabelFr}</span>
                {action.textFr}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function MissionPanel({ mission, mayEdit, statuses, onStatusChange }) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 space-y-6">
      <div>
        <h3 className="font-display text-lg text-text">{mission.titleFr}</h3>
        <p className="mt-1 text-[12.5px] text-text-muted">
          {mission.periodFr}
          {mission.referenceFr ? ` · ${mission.referenceFr}` : ''} ·{' '}
          {t('kaizen.internalLead', { value: mission.internalLeadFr })}
        </p>
        <p className="mt-3 text-[13.5px] text-text">{mission.contextFr}</p>
      </div>

      {mission.results.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-red-brand">{t('kaizen.results')}</h4>
          <ul className="list-disc space-y-1.5 ps-5">
            {mission.results.map((result) => (
              <li key={result.id} className="text-[13px] text-text">
                {result.textFr}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mission.journal.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-red-brand">
            {t('kaizen.missionJournal')}
          </h4>
          <ul className="space-y-2">
            {mission.journal.map((entry) => (
              <li key={entry.id} className="rounded-app border border-border bg-surface p-3 shadow-app">
                <p className="font-mono text-[11px] text-text-dim">{entry.dayFr}</p>
                <p className="text-[13px] text-text">{entry.activitiesFr}</p>
                <p className="mt-1 text-[12px] text-text-muted">{entry.outcomeFr}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mission.gaps.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-red-brand">{t('kaizen.gaps')}</h4>
          <table className="w-full text-start text-[13px]">
            <thead>
              <tr className="text-text-dim">
                <th className="pb-2 font-medium">{t('kaizen.columns.domain')}</th>
                <th className="pb-2 font-medium">{t('kaizen.columns.observed')}</th>
                <th className="pb-2 font-medium">{t('kaizen.columns.target')}</th>
              </tr>
            </thead>
            <tbody>
              {mission.gaps.map((gap) => (
                <tr key={gap.id} className="border-t border-border">
                  <td className="py-2 text-text">{gap.domainFr}</td>
                  <td className="py-2 text-text">{gap.observedFr}</td>
                  <td className="py-2 text-text">{gap.targetFr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mission.actions.length > 0 && (
        <div>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-red-brand">{t('kaizen.actionPlan')}</h4>
          <table className="w-full text-start text-[13px]">
            <thead>
              <tr className="text-text-dim">
                <th className="pb-2 font-medium">{t('kaizen.columns.action')}</th>
                <th className="pb-2 font-medium">{t('common.labels.manager')}</th>
                <th className="pb-2 font-medium">{t('common.labels.dueDate')}</th>
                <th className="pb-2 font-medium">{t('common.labels.status')}</th>
              </tr>
            </thead>
            <tbody>
              {mission.actions.map((action) => (
                <tr key={action.id} className="border-t border-border">
                  <td className="py-2 text-text">{action.actionFr}</td>
                  <td className="py-2 text-text">{action.ownerFr}</td>
                  <td className="py-2 font-mono text-text">{action.deadlineFr}</td>
                  <td className="py-2">
                    {mayEdit ? (
                      <select
                        value={action.statusFr}
                        onChange={(event) => onStatusChange(action.id, event.target.value)}
                        className="rounded-app border border-border bg-surface px-2 py-1 text-[12.5px]"
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-app bg-surface-2 px-2 py-1 text-[12px] text-text-dim">
                        {action.statusFr}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
