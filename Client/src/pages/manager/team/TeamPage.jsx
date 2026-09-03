import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { positionsApi } from '../../../api/organization.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';
import { rowVariants, sectionVariants, staggerContainer, initialOrNone } from '../../../lib/motion/variants.js';

/**
 * /app/manager/team (route guide §2.2, SITE).
 * "His org unit: members, job descriptions, vacant positions."
 * Backed by GET /positions/tree, already scoped to the manager's own sub-tree
 * (position-repository.js getVisibleTree — MANAGER role sees their full sub-tree).
 */
export default function TeamPage() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await positionsApi.tree();
        setNodes(data);
      } catch {
        setError(t('managerTeamPage.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  if (loading) return <PageLoading label={t('managerTeamPage.loading')} />;
  if (error) return <PageError message={error} />;

  const members = nodes.filter((node) => node.holder);
  const vacant = nodes.filter((node) => node.isVacant);

  return (
    <div>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('managerTeamPage.title')}
        subtitle={t('managerTeamPage.subtitle')}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <motion.section variants={sectionVariants} initial={initialOrNone(reduce)} animate="visible">
          <h2 className="mb-3 font-display text-lg text-text">{t('managerTeamPage.members', { count: members.length })}</h2>
          <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                  <th className="px-4 py-3 font-medium">{t('managerTeamPage.table.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('managerTeamPage.table.position')}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible">
                {members.map((node) => (
                  <motion.tr key={node.id} variants={rowVariants} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-3 text-text">{node.holder.displayName}</td>
                    <td className="px-4 py-3 text-text-dim">{node.titleFr}</td>
                    <td className="px-4 py-3 text-end">
                      <Link to="/job-description" className="text-xs font-medium text-red-brand hover:underline">
                        {t('managerTeamPage.jobDescriptions')}
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
            {members.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-text-dim">{t('managerTeamPage.noMembers')}</p>
            )}
          </div>
        </motion.section>

        <motion.section
          variants={sectionVariants}
          initial={initialOrNone(reduce)}
          animate="visible"
          transition={{ delay: reduce ? 0 : 0.1 }}
        >
          <h2 className="mb-3 font-display text-lg text-text">{t('managerTeamPage.vacancies', { count: vacant.length })}</h2>
          <div className="overflow-hidden rounded-app border border-border bg-surface shadow-app">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                  <th className="px-4 py-3 font-medium">{t('managerTeamPage.table.position')}</th>
                  <th className="px-4 py-3 font-medium">{t('managerTeamPage.table.occupation')}</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer(0.05)} initial={initialOrNone(reduce)} animate="visible">
                {vacant.map((node) => (
                  <motion.tr key={node.id} variants={rowVariants} className="border-b border-border last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-3 text-text">{node.titleFr}</td>
                    <td className="px-4 py-3 text-text-dim">{node.occupancyFr ?? '—'}</td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
            {vacant.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-text-dim">{t('managerTeamPage.noVacancies')}</p>
            )}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
