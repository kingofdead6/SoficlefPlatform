import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { managementApi } from '../../api/management.js';
import { ApiError } from '../../api/client.js';

export default function ManagementPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    managementApi
      .get()
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : t('common.states.loadFailed')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <div className="text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="text-status-red">{error}</div>;
  if (!data || (data.members.length === 0 && data.actions.length === 0 && data.orgChart.length === 0)) {
    return (
      <div className="rounded-app border border-border bg-surface p-6 text-text-dim shadow-app">
        {t('management.unavailable')}
      </div>
    );
  }

  const { members, actions, orgChart } = data;
  const rootNodes = orgChart.filter((node) => !node.parentId);
  const childrenOf = (parentId) => orgChart.filter((node) => node.parentId === parentId);

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl text-red-deep">{t('management.title')}</h1>

      {members.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
            {t('management.unitManagers')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {members.map((member) => (
              <div key={member.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <h4 className="font-display text-text">
                  {member.nameFr} · {member.initials}
                </h4>
                <div className="mt-2 space-y-1 text-[13px] text-text">
                  <p className="font-medium">{member.roleFr}</p>
                  <p className="text-[12.5px] text-text-muted">{member.scopeFr}</p>
                  <p className="text-[12px] text-text-muted">{member.tagFr}</p>
                  <p className="mt-2">{member.perimeterFr}</p>
                  <p className="mt-1 text-[12.5px] text-red-brand">
                    {t('management.priority30Days', { value: member.priorityJ30Fr })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {rootNodes.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">{t('management.orgChart')}</h3>
          <div className="space-y-3">
            {rootNodes.map((node) => (
              <div key={node.id} className="rounded-app border border-border bg-surface p-4 shadow-app">
                <h4 className="font-display text-text">{node.titleFr}</h4>
                {node.holderFr && <p className="mt-1 text-[13px] text-text">{node.holderFr}</p>}
                {childrenOf(node.id).length > 0 && (
                  <ul className="mt-3 space-y-2 border-s-2 border-border ps-4">
                    {childrenOf(node.id).map((child) => (
                      <li key={child.id} className="text-[13px] text-text">
                        <span className="font-medium">{child.titleFr}</span>
                        {child.holderFr && <span className="text-text-muted"> — {child.holderFr}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {actions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">{t('management.recommendedActions')}</h3>
          <ol className="space-y-2">
            {actions.map((action) => (
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
