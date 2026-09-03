import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { positionsApi } from '../../../api/organization.js';
import { onboardingApi } from '../../../api/onboarding.js';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import { PageLoading, PageError } from '../../../components/manager/PageStates.jsx';
import OrgChart from '../../../components/org/OrgChart.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';

/**
 * /app/manager/organigram (route guide §2.2, CHAIN/CORE).
 * Same upward view as a new hire, plus full expansion of the manager's entire sub-tree
 * (N-1, N-2, …) — already what GET /positions/tree returns for a MANAGER role
 * (position-repository.js). Onboarding badge with % progress on anyone currently in a
 * path; vacant positions in scope shown as empty nodes.
 *
 * Rendered by the shared top-down OrgChart; the reveal is GSAP-orchestrated level by
 * level, root first.
 */
export default function ManagerOrganigramPage() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState([]);
  const [recruits, setRecruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const scopeRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [treeRes, recruitsRes] = await Promise.all([
          positionsApi.tree(),
          onboardingApi.managerRecruits(false),
        ]);
        setNodes(treeRes.data);
        setRecruits(recruitsRes.data);
      } catch {
        setError(t('managerOrganigram.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const progressByUserId = useMemo(
    () => new Map(recruits.map((recruit) => [recruit.userId, recruit.percent])),
    [recruits],
  );

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
        tl.to(byDepth.get(depth), { opacity: 1, scale: 1, duration: 0.4, stagger: 0.06 }, depth * 0.16);
      }
    },
    [loading, nodes],
  );

  if (loading) return <PageLoading label={t('managerOrganigram.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div ref={scopeRef}>
      <PageHeader
        eyebrow={t('manager.eyebrow')}
        title={t('managerOrganigram.title')}
        subtitle={t('managerOrganigram.subtitle')}
      />

      <div className="overflow-x-auto rounded-app border border-border bg-surface p-6 shadow-app">
        <OrgChart
          nodes={nodes}
          emptyLabel={t('managerOrganigram.empty')}
          toneOf={(node) => (node.isVacant ? 'vacant' : undefined)}
          badgeOf={(node) => {
            const percent = node.holder ? progressByUserId.get(node.holder.id) : undefined;
            return percent === undefined ? undefined : t('managerOrganigram.onboardingBadge', { percent });
          }}
        />
      </div>
    </div>
  );
}
