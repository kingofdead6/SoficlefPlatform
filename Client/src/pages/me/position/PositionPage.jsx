import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { competenciesApi } from '../../../api/competencies.js';
import { positionsApi } from '../../../api/organization.js';
import { onboardingApi } from '../../../api/onboarding.js';
import { useAuth } from '../../../auth/AuthContext.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import ProgressRing from '../../../components/manager/ProgressRing.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import OrgChart from '../../../components/org/OrgChart.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';
import { staggerContainer, staggerItem, sectionVariants, initialOrNone } from '../../../lib/motion/variants.js';
import { cn } from '../../../lib/cn.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const GAP_LABEL_KEYS = {
  conforme: 'me.position.gap.conforme',
  'a-developper': 'me.position.gap.toDevelop',
  critique: 'me.position.gap.critical',
  'non-evalue': 'me.position.gap.notAssessed',
};

const GAP_STYLES = {
  conforme: 'bg-status-green/10 text-status-green',
  'a-developper': 'bg-status-amber/10 text-status-amber',
  critique: 'bg-status-red/10 text-status-red',
  'non-evalue': 'bg-surface-2 text-text-dim',
};

/**
 * /app/me/position — Ma fiche de poste (route guide §2.1, SITE).
 * "Job description: title, mission, reporting line, required skills, assigned equipment;
 * embedded org-chart snippet."
 *
 * Assembled from three reads a SELF-scoped employee genuinely holds:
 *   * GET /competencies/matrix — the post's required competencies against the caller's own
 *     assessed level. This is the "required skills" half, and it is the caller's own matrix:
 *     loadPositionMatrix resolves the post from their own live assignment.
 *   * GET /positions/tree — the post itself, its mission, its reporting line, and the
 *     org-chart snippet, filtered here to the caller's own branch.
 *   * GET /onboarding/me/overview — the post title and mission as the platform records them.
 *
 * The page does *not* call GET /job-descriptions: `listJobDescriptions` asserts
 * `job_description:read` with no target, which a SELF-scoped caller fails by construction.
 * Rather than show every employee a permission error where the spec asks for a sheet, the
 * detailed dossier is named as an HR-held document with a link to ask for it.
 *
 * "Assigned equipment" has no home in this schema — no equipment, asset or allocation table
 * exists. The section says so instead of inventing a list, and points at the real place the
 * question gets answered (the IT-owned steps of the journey).
 */
export default function PositionPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [matrix, setMatrix] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reduce = useReducedMotion();
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [matrixRes, treeRes, overviewRes] = await Promise.all([
          competenciesApi.matrix().catch(() => ({ data: null })),
          positionsApi.tree().catch(() => ({ data: [] })),
          onboardingApi.meOverview().catch(() => ({ data: null })),
        ]);
        setMatrix(matrixRes.data);
        setNodes(treeRes.data ?? []);
        setOverview(overviewRes.data);
      } catch {
        setError(t('me.position.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const myNode = useMemo(
    () => nodes.find((node) => node.holder?.id === user?.id) ?? null,
    [nodes, user],
  );

  /**
   * The "org-chart snippet": the caller's own branch, not the whole visible window — their
   * superior, themselves, their peers and whatever hangs beneath them. On a page about one
   * post, showing three levels of unrelated cousins would be noise.
   */
  const snippet = useMemo(() => {
    if (!myNode) return [];

    const keep = new Set([myNode.id]);
    if (myNode.parentPositionId) keep.add(myNode.parentPositionId);
    for (const node of nodes) {
      if (node.parentPositionId === myNode.id) keep.add(node.id);
      if (myNode.parentPositionId && node.parentPositionId === myNode.parentPositionId) keep.add(node.id);
    }
    return nodes.filter((node) => keep.has(node.id));
  }, [nodes, myNode]);

  const manager = useMemo(
    () => (myNode?.parentPositionId ? (nodes.find((node) => node.id === myNode.parentPositionId) ?? null) : null),
    [nodes, myNode],
  );

  const reports = useMemo(
    () => (myNode ? nodes.filter((node) => node.parentPositionId === myNode.id) : []),
    [nodes, myNode],
  );

  useGsapContext(
    scopeRef,
    ({ gsap, scope }, reduced) => {
      if (reduced) {
        gsap.set('[data-gsap="band"]', { opacity: 1, y: 0 });
        gsap.set(scope.querySelectorAll('[data-org-card]'), { opacity: 1, scale: 1 });
        return;
      }
      gsap.set('[data-gsap="band"]', { opacity: 0, y: 20 });
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .to('[data-gsap="band"]', { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 });

      const cards = scope.querySelectorAll('[data-org-card]');
      if (cards.length > 0) {
        gsap.set(cards, { opacity: 0, scale: 0.94 });
        gsap.to(cards, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.06, delay: 0.3, ease: 'back.out(1.5)' });
      }
    },
    [loading, matrix, snippet],
  );

  if (loading) return <PageLoading label={t('me.position.loading')} />;
  if (error) return <PageError message={error} />;

  const positionTitle =
    myNode?.titleFr ?? matrix?.positionTitleFr ?? overview?.position?.titleFr ?? null;

  if (!positionTitle) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader eyebrow={t('me.eyebrow')} title={t('me.position.title')} />
        <EmptyState
          title={t('me.position.unassignedTitle')}
          detail={t('me.position.unassignedDetail')}
          muted
        />
      </div>
    );
  }

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={positionTitle}
        subtitle={myNode?.organizationUnitNameFr ?? t('me.position.noStructure')}
        actions={
          <Link
            to="/app/me/organigram"
            className="rounded-app border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-red-brand hover:text-red-brand"
          >
            {t('me.position.fullOrgChart')}
          </Link>
        }
      />

      {/* Band 1 — identity of the post. */}
      <div data-gsap="band" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t('me.position.tiles.title')} value={positionTitle} />
        <Tile label={t('me.position.tiles.positionCode')} value={myNode?.code ?? matrix?.positionCode ?? '—'} mono />
        <Tile label={t('me.position.tiles.structure')} value={myNode?.organizationUnitNameFr ?? '—'} />
        <Tile
          label={t('me.position.tiles.reportsTo')}
          value={manager ? `${manager.titleFr}` : t('me.position.noManagerVisible')}
          detail={manager?.holder?.displayName}
        />
      </div>

      <div className="grid flex-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Mission. */}
          <motion.section
            data-gsap="band"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className={`${CARD} p-6`}
          >
            <h2 className="mb-3 font-display text-lg text-text">{t('me.position.mission.heading')}</h2>
            {overview?.position?.missionFr ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-dim">
                {overview.position.missionFr}
              </p>
            ) : (
              <EmptyState detail={t('me.position.mission.empty')} muted />
            )}
          </motion.section>

          {/* Required skills — the real competency matrix. */}
          <motion.section
            data-gsap="band"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
          >
            <h2 className="mb-1 font-display text-lg text-text">{t('me.position.skills.heading')}</h2>
            <p className="mb-4 text-xs text-text-dim">{t('me.position.skills.subtitle')}</p>

            {!matrix ? (
              <EmptyState detail={t('me.position.skills.noMatrix')} muted />
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniFigure label={t('me.position.skills.conforming')} value={matrix.summary.conforme} />
                  <MiniFigure label={t('me.position.skills.toDevelop')} value={matrix.summary.aDevelopper} />
                  <MiniFigure
                    label={t('me.position.skills.critical')}
                    value={matrix.summary.critique}
                    tone={matrix.summary.critique > 0 ? 'red' : undefined}
                  />
                  <div className={`${CARD} flex items-center justify-center p-3`}>
                    <ProgressRing
                      percent={matrix.summary.conformityRate ?? 0}
                      tone={
                        matrix.summary.conformityRate === null
                          ? 'brand'
                          : matrix.summary.conformityRate >= 80
                            ? 'green'
                            : 'brand'
                      }
                      label={matrix.summary.conformityRate === null ? '—' : `${matrix.summary.conformityRate}%`}
                    />
                  </div>
                </div>

                <div className={`overflow-x-auto ${CARD}`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-2 text-start text-text-muted">
                        <th className="px-4 py-3 font-medium">{t('me.position.skills.table.competency')}</th>
                        <th className="px-4 py-3 font-medium">{t('me.position.skills.table.family')}</th>
                        <th className="px-4 py-3 font-medium">{t('me.position.skills.table.required')}</th>
                        <th className="px-4 py-3 font-medium">{t('me.position.skills.table.attained')}</th>
                        <th className="px-4 py-3 font-medium">{t('common.labels.status')}</th>
                      </tr>
                    </thead>
                    <motion.tbody
                      variants={staggerContainer(0.03)}
                      initial={initialOrNone(reduce)}
                      animate="visible"
                    >
                      {matrix.rows.map((row) => (
                        <motion.tr
                          key={row.competencyId}
                          variants={staggerItem}
                          className="border-b border-border last:border-0 hover:bg-surface-2/60"
                        >
                          <td className="px-4 py-3 text-text">{row.nameFr}</td>
                          <td className="px-4 py-3 text-text-dim">{row.familyFr ?? '—'}</td>
                          <td className="px-4 py-3 text-text-dim">
                            {row.requiredLevel} / {matrix.maxLevel}
                          </td>
                          <td className="px-4 py-3 text-text-dim">{row.gap.actualLevel ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium',
                                GAP_STYLES[row.gap.status],
                              )}
                            >
                              {t(GAP_LABEL_KEYS[row.gap.status])}
                            </span>
                          </td>
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                  {matrix.rows.length === 0 && (
                    <p className="py-8 text-center text-sm text-text-dim">
                      {t('me.position.skills.noRows')}
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.section>

          {/* Org-chart snippet. */}
          <motion.section
            data-gsap="band"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
          >
            <h2 className="mb-1 font-display text-lg text-text">{t('me.position.orgSnippet.heading')}</h2>
            <p className="mb-4 text-xs text-text-dim">{t('me.position.orgSnippet.subtitle')}</p>
            <div className={`overflow-x-auto ${CARD} p-6`}>
              <OrgChart
                nodes={snippet}
                emptyLabel={t('me.position.orgSnippet.empty')}
                toneOf={(node) => (node.id === myNode?.id ? 'root' : node.isVacant ? 'vacant' : undefined)}
                subtitleOf={(node) => node.organizationUnitNameFr ?? undefined}
                badgeOf={(node) => (node.id === myNode?.id ? t('me.organigram.youBadge') : undefined)}
              />
            </div>
          </motion.section>
        </div>

        {/* Right column — reporting line, equipment, and the honest note about the dossier. */}
        <div className="space-y-6">
          <motion.section
            data-gsap="band"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className={`${CARD} p-5`}
          >
            <h2 className="mb-3 font-display text-lg text-text">{t('me.position.reportingLine.heading')}</h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                  {t('me.position.reportingLine.manager')}
                </dt>
                <dd className="text-text">
                  {manager ? (
                    <>
                      {manager.titleFr}
                      {manager.holder && (
                        <span className="block text-xs text-text-dim">{manager.holder.displayName}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-text-dim">{t('me.position.noManagerVisible')}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-text-dim">
                  {t('me.position.reportingLine.directReports', { count: reports.length })}
                </dt>
                <dd className="text-text">
                  {reports.length === 0 ? (
                    <span className="text-text-dim">{t('common.states.none')}</span>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {reports.map((report) => (
                        <li key={report.id} className="text-sm text-text-dim">
                          {report.titleFr}
                          {report.holder
                            ? ` — ${report.holder.displayName}`
                            : ` — ${t('me.organigram.sheet.vacant')}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </dl>
          </motion.section>

          <motion.section
            data-gsap="band"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
          >
            <h2 className="mb-3 font-display text-lg text-text">{t('me.position.equipment.heading')}</h2>
            <EmptyState
              title={t('me.position.equipment.emptyTitle')}
              detail={t('me.position.equipment.emptyDetail')}
              muted
            />
            <Link
              to="/app/me/journey"
              className="mt-3 inline-block text-xs font-medium text-red-brand hover:underline"
            >
              {t('me.position.equipment.seeJourney')}
            </Link>
          </motion.section>

          <motion.section
            data-gsap="band"
            variants={sectionVariants}
            initial={initialOrNone(reduce)}
            animate="visible"
            className={`${CARD} p-5`}
          >
            <h2 className="mb-2 font-display text-lg text-text">{t('me.position.fullDossier.heading')}</h2>
            <p className="text-xs leading-relaxed text-text-dim">{t('me.position.fullDossier.detail')}</p>
            <Link
              to="/app/me/team"
              className="mt-3 inline-block text-xs font-medium text-red-brand hover:underline"
            >
              {t('me.position.fullDossier.hrContactLink')}
            </Link>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, detail, mono }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={cn('font-display text-lg leading-snug text-red-deep', mono && 'font-mono text-base')}>
        {value}
      </p>
      {detail && <p className="mt-1 text-xs text-text-dim">{detail}</p>}
    </div>
  );
}

function MiniFigure({ label, value, tone }) {
  return (
    <div className={`${CARD} p-3`}>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className={cn('font-display text-2xl', tone === 'red' ? 'text-status-red' : 'text-red-deep')}>
        <CountUp value={value} />
      </p>
    </div>
  );
}
