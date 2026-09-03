import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { organizationUnitsApi, positionsApi } from '../../../api/organization.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import OrgChart from '../../../components/org/OrgChart.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, initialOrNone } from '../../../lib/motion/variants.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /app/hr/organigram (route guide §2.3, CORE).
 * "Whole company, expandable from any node; filters; vacant positions highlighted; anomaly
 * view (no manager, no holder, orphan nodes)."
 *
 * HR's global scope means GET /positions/tree already returns the entire chart
 * (position-repository.js short-circuits to the whole table for a global read), so the tree
 * here really is company-wide rather than a windowed view.
 *
 * The anomaly view is computed from the same flat node list rather than fetched: an orphan
 * is a node whose declared parent is not in the returned set, a headless branch is a node
 * with children but no holder, and a vacancy is `isVacant`. Deriving them here keeps the
 * definition visible next to the tree it describes.
 *
 * Reveal is GSAP-orchestrated by depth, matching the manager organigram.
 */
export default function HrOrganigramPage() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [unitId, setUnitId] = useState('');
  const [showVacantOnly, setShowVacantOnly] = useState(false);
  const [view, setView] = useState('tree');
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [treeRes, unitsRes] = await Promise.all([positionsApi.tree(), organizationUnitsApi.list()]);
        setNodes(treeRes.data);
        setUnits(unitsRes.data);
      } catch {
        setError(t('hr.organigram.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);

  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

  /**
   * The anomalies the spec names, each with the rule that produced it stated on the card so
   * nobody has to guess what "orphelin" means here.
   */
  const anomalies = useMemo(() => {
    const childCount = new Map();
    for (const node of nodes) {
      if (node.parentPositionId) {
        childCount.set(node.parentPositionId, (childCount.get(node.parentPositionId) ?? 0) + 1);
      }
    }

    return {
      vacant: nodes.filter((node) => node.isVacant),
      // A post with people under it but nobody in it: the branch has no manager.
      headless: nodes.filter((node) => !node.holder && (childCount.get(node.id) ?? 0) > 0),
      // Declares a parent that isn't in the chart — a dangling reference, not a root.
      orphans: nodes.filter((node) => node.parentPositionId && !nodeIds.has(node.parentPositionId)),
      // No structure at all: the post floats outside every division.
      unattached: nodes.filter((node) => !node.organizationUnitId),
    };
  }, [nodes, nodeIds]);

  const highlightIds = useMemo(
    () =>
      new Set([
        ...anomalies.headless.map((node) => node.id),
        ...anomalies.orphans.map((node) => node.id),
      ]),
    [anomalies],
  );

  /**
   * Filtering keeps a node when it matches, and keeps its ancestors so the match stays
   * reachable in the tree rather than being orphaned by its own filter.
   */
  const visibleNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term && !unitId && !showVacantOnly) return nodes;

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const matches = nodes.filter((node) => {
      if (unitId && node.organizationUnitId !== unitId) return false;
      if (showVacantOnly && !node.isVacant) return false;
      if (!term) return true;
      return (
        node.titleFr.toLowerCase().includes(term) ||
        node.code.toLowerCase().includes(term) ||
        (node.holder?.displayName ?? '').toLowerCase().includes(term)
      );
    });

    const keep = new Set();
    for (const match of matches) {
      let current = match;
      while (current && !keep.has(current.id)) {
        keep.add(current.id);
        current = current.parentPositionId ? byId.get(current.parentPositionId) : null;
      }
    }
    return nodes.filter((node) => keep.has(node.id));
  }, [nodes, search, unitId, showVacantOnly]);

  /**
   * Reveal level by level, so the chart draws itself from the top of the company down.
   * Depth comes from OrgChart's `data-org-depth`, which it sets on every branch.
   */
  useGsapContext(
    scopeRef,
    ({ gsap, scope }, reduced) => {
      const cards = scope.querySelectorAll('[data-org-card]');
      if (cards.length === 0) return;
      if (reduced) {
        gsap.set(cards, { opacity: 1, scale: 1 });
        return;
      }
      gsap.set(cards, { opacity: 0, scale: 0.94 });

      const byDepth = new Map();
      for (const card of cards) {
        const depth = Number(card.closest('[data-org-depth]')?.dataset.orgDepth ?? 0);
        if (!byDepth.has(depth)) byDepth.set(depth, []);
        byDepth.get(depth).push(card);
      }

      const tl = gsap.timeline({ defaults: { ease: 'back.out(1.5)' } });
      for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
        tl.to(byDepth.get(depth), { opacity: 1, scale: 1, duration: 0.4, stagger: 0.05 }, depth * 0.14);
      }
    },
    [loading, view, visibleNodes],
  );

  if (loading) return <PageLoading label={t('hr.organigram.loading')} />;
  if (error) return <PageError message={error} />;

  const anomalyTotal =
    anomalies.vacant.length +
    anomalies.headless.length +
    anomalies.orphans.length +
    anomalies.unattached.length;

  return (
    <div ref={scopeRef}>
      <PageHeader
        eyebrow={t('hr.dashboard.eyebrow')}
        title={t('hr.organigram.title')}
        subtitle={t('hr.organigram.subtitle')}
      />

      <div className="mb-6 flex gap-2 border-b border-border">
        {[
          { id: 'tree', label: t('hr.organigram.tabs.tree') },
          { id: 'anomalies', label: t('hr.organigram.tabs.anomalies', { count: anomalyTotal }) },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              view === tab.id
                ? 'border-red-brand text-red-deep'
                : 'border-transparent text-text-dim hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'tree' ? (
        <>
          <div className={`${CARD} mb-6 flex flex-wrap items-center gap-3 p-4`}>
            <input
              type="search"
              placeholder={t('hr.organigram.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${fieldClass} min-w-[240px] flex-1`}
            />
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={fieldClass}>
              <option value="">{t('hr.organigram.allStructures')}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} — {unit.nameFr}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={showVacantOnly}
                onChange={(e) => setShowVacantOnly(e.target.checked)}
                className="accent-[var(--color-red-brand)]"
              />
              {t('hr.organigram.vacantOnly')}
            </label>
            <span className="ml-auto text-sm text-text-dim">
              {t('hr.organigram.positionCount', { visible: visibleNodes.length, total: nodes.length })}
            </span>
          </div>

          <div className={`overflow-x-auto ${CARD} p-6`}>
            <OrgChart
              nodes={visibleNodes}
              emptyLabel={t('hr.organigram.emptyFiltered')}
              toneOf={(node) =>
                highlightIds.has(node.id) ? 'flagged' : node.isVacant ? 'vacant' : undefined
              }
              subtitleOf={(node) => unitById.get(node.organizationUnitId)?.code}
            />
          </div>
        </>
      ) : (
        <AnomalyView anomalies={anomalies} unitById={unitById} t={t} />
      )}
    </div>
  );
}

function AnomalyView({ anomalies, unitById, t }) {
  const reduce = useReducedMotion();

  const groups = [
    {
      id: 'vacant',
      titleKey: 'vacant',
      nodes: anomalies.vacant,
      tone: 'brand',
    },
    {
      id: 'headless',
      titleKey: 'headless',
      nodes: anomalies.headless,
      tone: 'red',
    },
    {
      id: 'orphans',
      titleKey: 'orphans',
      nodes: anomalies.orphans,
      tone: 'red',
    },
    {
      id: 'unattached',
      titleKey: 'unattached',
      nodes: anomalies.unattached,
      tone: 'red',
    },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        variants={staggerContainer(0.06)}
        initial={initialOrNone(reduce)}
        animate="visible"
        className="grid gap-4 sm:grid-cols-4"
      >
        {groups.map((group) => (
          <motion.div key={group.id} variants={staggerItem} className={`${CARD} p-5`}>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
              {t(`hr.organigram.anomalies.${group.titleKey}.title`)}
            </p>
            <p
              className={`font-display text-3xl ${
                group.nodes.length > 0 && group.tone === 'red' ? 'text-status-red' : 'text-red-deep'
              }`}
            >
              <CountUp value={group.nodes.length} />
            </p>
          </motion.div>
        ))}
      </motion.div>

      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="font-display text-lg text-text">{t(`hr.organigram.anomalies.${group.titleKey}.title`)}</h2>
          <p className="mb-3 text-xs text-text-dim">{t(`hr.organigram.anomalies.${group.titleKey}.rule`)}</p>
          {group.nodes.length === 0 ? (
            <EmptyState detail={t('hr.organigram.noAnomaly')} muted />
          ) : (
            <div className={`overflow-hidden ${CARD}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                    <th className="px-4 py-3 font-medium">{t('hr.organigram.table.position')}</th>
                    <th className="px-4 py-3 font-medium">{t('hr.organigram.table.code')}</th>
                    <th className="px-4 py-3 font-medium">{t('hr.organigram.table.structure')}</th>
                    <th className="px-4 py-3 font-medium">{t('hr.organigram.table.holder')}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.nodes.map((node) => (
                    <tr key={node.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text">
                        <Link to="/app/hr/positions" className="hover:text-red-brand">
                          {node.titleFr}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-dim">{node.code}</td>
                      <td className="px-4 py-3 text-text-dim">
                        {unitById.get(node.organizationUnitId)?.nameFr ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-dim">
                        {node.holder?.displayName ?? t('hr.organigram.vacant')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
