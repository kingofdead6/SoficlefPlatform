import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { positionsApi } from '../../../api/organization.js';
import { useAuth } from '../../../auth/AuthContext.jsx';
import PageHeader from '../../../components/manager/PageHeader.jsx';
import CountUp from '../../../components/manager/CountUp.jsx';
import { PageLoading, PageError, EmptyState } from '../../../components/manager/PageStates.jsx';
import OrgChart from '../../../components/org/OrgChart.jsx';
import Avatar from '../../../components/me/Avatar.jsx';
import { useGsapContext } from '../../../lib/motion/useGsapContext.js';

const CARD = 'rounded-app border border-border bg-surface shadow-app';

const fieldClass =
  'rounded-app border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors focus:border-red-brand';

/**
 * /app/me/organigram — Organigramme (route guide §2.1, CHAIN/CORE).
 * "Tree centred on himself — upward to the division head, downward to direct reports,
 * sideways to peers; cards show photo, name, position, department, email, extension; click a
 * card for a read-only position sheet."
 *
 * The centring is *not* done here. GET /positions/tree already returns exactly that window
 * for a SELF-scoped caller: position-repository.js anchors on the caller's own post and walks
 * a configured number of levels up, the same number down, and optionally the siblings. Doing
 * it again client-side would either duplicate that rule or contradict it — and, worse, would
 * imply the browser could widen the window, which it cannot.
 *
 * The click-through sheet is read-only and built from the node the tree already returned. It
 * does not call GET /positions/:id: that endpoint refuses a SELF-scoped caller by design
 * (findPositionForUser returns null for scope.kind === 'self'), so calling it would show
 * every employee an error where the spec asks for a sheet. Everything the sheet displays is
 * a field the chart itself already carried.
 */
export default function MeOrganigramPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const scopeRef = useRef(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await positionsApi.tree();
        setNodes(data);
      } catch {
        setError(t('me.organigram.loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  /** The caller's own post, so the chart can mark "vous êtes ici". */
  const myNodeId = useMemo(
    () => nodes.find((node) => node.holder?.id === user?.id)?.id ?? null,
    [nodes, user],
  );

  const stats = useMemo(() => {
    const me = nodes.find((node) => node.id === myNodeId) ?? null;
    const reports = me ? nodes.filter((node) => node.parentPositionId === me.id) : [];
    const peers = me?.parentPositionId
      ? nodes.filter((node) => node.parentPositionId === me.parentPositionId && node.id !== me.id)
      : [];
    const manager = me?.parentPositionId
      ? (nodes.find((node) => node.id === me.parentPositionId) ?? null)
      : null;
    return { me, reports, peers, manager };
  }, [nodes, myNodeId]);

  /** Search keeps matches plus their ancestors, so a hit is never orphaned from the tree. */
  const visibleNodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return nodes;

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const matches = nodes.filter(
      (node) =>
        node.titleFr.toLowerCase().includes(term) ||
        node.code.toLowerCase().includes(term) ||
        (node.holder?.displayName ?? '').toLowerCase().includes(term) ||
        (node.organizationUnitNameFr ?? '').toLowerCase().includes(term),
    );

    const keep = new Set();
    for (const match of matches) {
      let current = match;
      while (current && !keep.has(current.id)) {
        keep.add(current.id);
        current = current.parentPositionId ? byId.get(current.parentPositionId) : null;
      }
    }
    return nodes.filter((node) => keep.has(node.id));
  }, [nodes, search]);

  /** Reveal level by level, exactly as the HR and manager organigrams do. */
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
    [loading, visibleNodes],
  );

  if (loading) return <PageLoading label={t('me.organigram.loading')} />;
  if (error) return <PageError message={error} />;

  return (
    <div ref={scopeRef} className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={t('me.eyebrow')}
        title={t('me.organigram.title')}
        subtitle={t('me.organigram.subtitle')}
      />

      {nodes.length === 0 ? (
        <EmptyState
          title={t('me.organigram.unavailableTitle')}
          detail={t('me.organigram.unavailableDetail')}
          muted
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SheetTile label={t('me.organigram.myPosition')} value={stats.me?.titleFr ?? t('me.organigram.unassigned')} />
            <SheetTile
              label={t('me.organigram.myManager')}
              value={stats.manager?.holder?.displayName ?? stats.manager?.titleFr ?? '—'}
            />
            <CountTile label={t('me.organigram.peers')} value={stats.peers.length} />
            <CountTile label={t('me.organigram.directReports')} value={stats.reports.length} />
          </div>

          <div className={`${CARD} mb-6 flex flex-wrap items-center gap-3 p-4`}>
            <input
              type="search"
              placeholder={t('me.organigram.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${fieldClass} min-w-[240px] flex-1`}
            />
            <span className="text-sm text-text-dim">
              {t('me.organigram.visibleCount', { visible: visibleNodes.length, total: nodes.length })}
            </span>
          </div>

          <p className="mb-4 text-xs text-text-dim">{t('me.organigram.windowNote')}</p>

          <div className={`overflow-x-auto ${CARD} p-6`}>
            <OrgChart
              nodes={visibleNodes}
              emptyLabel={t('me.organigram.noSearchMatch')}
              onSelect={setSelected}
              toneOf={(node) => (node.id === myNodeId ? 'root' : node.isVacant ? 'vacant' : undefined)}
              subtitleOf={(node) => node.organizationUnitNameFr ?? undefined}
              badgeOf={(node) => (node.id === myNodeId ? t('me.organigram.youBadge') : undefined)}
            />
          </div>
        </>
      )}

      <AnimatePresence>
        {selected && (
          <PositionSheet
            node={selected}
            isMe={selected.id === myNodeId}
            manager={nodes.find((node) => node.id === selected.parentPositionId) ?? null}
            reports={nodes.filter((node) => node.parentPositionId === selected.id)}
            onClose={() => setSelected(null)}
            reduce={reduce}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SheetTile({ label, value }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className="font-display text-lg leading-snug text-red-deep">{value}</p>
    </div>
  );
}

function CountTile({ label, value }) {
  return (
    <div className={`${CARD} p-5`}>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</p>
      <p className="font-display text-3xl text-red-deep">
        <CountUp value={value} />
      </p>
    </div>
  );
}

/**
 * The read-only sheet §2.1 asks for, as a right-hand drawer.
 *
 * Read-only is not a styling choice here: an employee holds `position:read` and nothing
 * else on this resource, so there is no edit this panel could offer that the server would
 * accept. Saying "consultation seule" on the panel is more useful than a disabled button.
 */
function PositionSheet({ node, isMe, manager, reports, onClose, reduce }) {
  const { t } = useTranslation();
  const holder = node.holder;

  return (
    <motion.div
      initial={reduce ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 flex justify-end bg-text/20"
      onClick={onClose}
    >
      <motion.aside
        initial={reduce ? { x: 0 } : { x: 40 }}
        animate={{ x: 0 }}
        exit={reduce ? { x: 0 } : { x: 40 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface p-6 shadow-app-lifted"
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-red-brand">
              {t('me.organigram.sheet.readOnlyBadge')}
            </p>
            <h2 className="font-display text-2xl leading-tight text-red-deep">{node.titleFr}</h2>
            <p className="mt-1 font-mono text-xs text-text-dim">{node.code}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-app border border-border px-3 py-1.5 text-sm text-text-dim transition-colors hover:border-red-brand hover:text-red-brand"
          >
            {t('common.actions.close')}
          </button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <Avatar name={holder?.displayName} url={holder?.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate font-medium text-text">
              {holder?.displayName ?? (node.occupancyFr || t('me.organigram.sheet.vacantPosition'))}
            </p>
            <p className="truncate text-sm text-text-dim">
              {node.organizationUnitNameFr ?? t('me.organigram.sheet.noStructure')}
            </p>
            {isMe && (
              <span className="mt-1 inline-block rounded-full bg-red-brand/10 px-2 py-0.5 text-[11px] font-medium text-red-brand">
                {t('me.organigram.sheet.thisIsYou')}
              </span>
            )}
          </div>
        </div>

        <dl className="space-y-4">
          <SheetField label={t('me.organigram.sheet.departmentLabel')}>
            {node.organizationUnitNameFr ?? '—'}
          </SheetField>
          <SheetField label={t('common.labels.email')}>
            {holder?.email ? (
              <a href={`mailto:${holder.email}`} className="text-red-brand hover:underline">
                {holder.email}
              </a>
            ) : (
              '—'
            )}
          </SheetField>
          <SheetField label={t('me.organigram.sheet.extensionLabel')}>{holder?.phone ?? '—'}</SheetField>
          <SheetField label={t('me.organigram.sheet.reportsToLabel')}>
            {manager
              ? `${manager.titleFr}${manager.holder ? ` — ${manager.holder.displayName}` : ''}`
              : t('me.organigram.sheet.noManagerVisible')}
          </SheetField>
          <SheetField label={t('me.organigram.sheet.directReportsLabel')}>
            {reports.length === 0 ? (
              t('common.states.none')
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
          </SheetField>
          <SheetField label={t('me.organigram.sheet.occupancyLabel')}>
            {node.isVacant ? (
              <span className="text-status-red">{node.occupancyFr || t('me.organigram.sheet.vacantPosition')}</span>
            ) : (
              (node.occupancyFr ?? t('me.organigram.sheet.occupied'))
            )}
          </SheetField>
        </dl>

        <p className="mt-8 border-t border-border pt-5 text-xs text-text-dim">
          {t('me.organigram.sheet.footnote')}
        </p>
      </motion.aside>
    </motion.div>
  );
}

function SheetField({ label, children }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-text-dim">{label}</dt>
      <dd className="text-sm text-text">{children}</dd>
    </div>
  );
}
