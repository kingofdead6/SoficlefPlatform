import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationUnitsApi, positionsApi } from '../../api/organization.js';
import OrgChart from '../../components/org/OrgChart.jsx';

/**
 * The organization screen: units list and the visible slice of the org chart.
 * Ported loosely from SoficlefPlatform's /organization page — functional correctness
 * over visual polish per the migration brief.
 */
export default function OrganizationPage() {
  const { t } = useTranslation();
  const [units, setUnits] = useState([]);
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [unitsRes, treeRes] = await Promise.all([organizationUnitsApi.list(), positionsApi.tree()]);
        setUnits(unitsRes.data);
        setTree(treeRes.data);
      } catch {
        setError(t('organization.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <div className="p-6 text-text-dim">{t('common.states.loading')}</div>;
  if (error) return <div className="p-6 text-status-red">{error}</div>;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-red-deep">{t('organization.title')}</h1>
      <p className="mb-6 text-text-dim">{t('organization.subtitle')}</p>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-text">{t('organization.units')}</h2>
        <div className="overflow-x-auto rounded-app border border-border bg-surface shadow-app">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-text-dim">
                <th className="px-3 py-2">{t('organization.columns.code')}</th>
                <th className="px-3 py-2">{t('common.labels.name')}</th>
                <th className="px-3 py-2">{t('common.labels.type')}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{unit.code}</td>
                  <td className="px-3 py-2">{unit.nameFr}</td>
                  <td className="px-3 py-2 text-text-dim">{unit.type}</td>
                </tr>
              ))}
              {units.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-text-dim">
                    {t('organization.noUnits')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-text">{t('organization.orgChart')}</h2>
        <div className="overflow-x-auto rounded-app border border-border bg-surface p-6 shadow-app">
          <OrgChart
            nodes={tree}
            emptyLabel={t('organization.noPositions')}
            toneOf={(node) => (node.isVacant ? 'vacant' : undefined)}
          />
        </div>
      </section>
    </div>
  );
}
