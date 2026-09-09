import { memo, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/**
 * Top-down organisation chart: a centred parent card with a horizontal row of children
 * beneath it, joined by elbow connectors — the conventional org-chart shape, rather than
 * the indented outline the pages used before.
 *
 * The connectors are drawn with bordered pseudo-boxes rather than SVG, so they reflow
 * with the cards on their own and survive horizontal scrolling without any measuring:
 *
 *      ┌──────────┐            parent
 *      └────┬─────┘
 *      ┌────┴────┐             `stem`  — drops out of the parent
 *   ┌──┴──┐   ┌──┴──┐          `rail`  — spans the children, half-width at each end
 *   │child│   │child│          `riser` — lifts into each child
 *
 * Consumers pass a flat node list ({ id, parentPositionId, ... }); the tree is built here
 * so every org-chart page agrees on what a root is (a node whose declared parent is not
 * in the visible set — a filtered-out or dangling parent still yields a root, never a
 * dropped branch).
 */

const LINE = 'border-border';

export function buildOrgTree(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, { ...node, children: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const parent = node.parentPositionId ? byId.get(node.parentPositionId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Initials for the avatar disc, e.g. "Amina Belkacem" -> "AB". */
function initialsOf(name) {
  if (!name) return null;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="currentColor">
    <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
  </svg>
);

/**
 * One card. `tone` drives the accent: 'vacant' for an empty post, 'flagged' for an
 * anomaly, 'root' for the top of the chart.
 */
const OrgNodeCard = memo(function OrgNodeCard({ node, tone, subtitle, badge, onSelect, reduce, variant }) {
  const { t } = useTranslation();
  const holderName = node.holder?.displayName ?? null;
  const initials = initialsOf(holderName);

  const shell =
    tone === 'flagged'
      ? 'border-status-red/50 bg-status-red/5'
      : tone === 'vacant'
        ? 'border-dashed border-red-brand/50 bg-red-brand/5'
        : tone === 'root'
          ? 'border-red-brand/40 bg-red-brand/10'
          : 'border-border bg-surface';

  const interactive = typeof onSelect === 'function';
  const Tag = interactive ? 'button' : 'div';

  /*
   * `variant="unit"` is the flat, solid-block look of the printed SOFICLEF organigramme:
   * one colour per organisational level (direction générale / direction / structure /
   * cellule) instead of the card-with-avatar shape the staffing charts use. It is opt-in
   * so the positions-based charts elsewhere (HR, manager, "me", admin) are untouched.
   */
  if (variant === 'unit') {
    const block = UNIT_TONE[tone] ?? UNIT_TONE.structure;

    return (
      <motion.div
        whileHover={reduce || !interactive ? undefined : { y: -2 }}
        transition={{ duration: 0.18 }}
        data-org-card
      >
        <Tag
          {...(interactive ? { type: 'button', onClick: () => onSelect(node) } : {})}
          className={`flex w-[196px] flex-col items-center gap-1 rounded-md px-3 py-3 text-center shadow-app transition-transform ${block.shell} ${
            interactive ? 'cursor-pointer hover:scale-[1.02]' : ''
          }`}
        >
          <span className="w-full text-[13px] font-bold uppercase leading-snug tracking-tight">
            {node.titleFr}
          </span>
          {subtitle && (
            <span className={`w-full truncate text-[10px] uppercase tracking-wide ${block.subtitle}`}>
              {subtitle}
            </span>
          )}
          {badge && (
            <span className="mt-0.5 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-text">
              {badge}
            </span>
          )}
        </Tag>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={reduce || !interactive ? undefined : { y: -2 }}
      transition={{ duration: 0.18 }}
      data-org-card
    >
      <Tag
        {...(interactive ? { type: 'button', onClick: () => onSelect(node) } : {})}
        className={`flex w-[188px] flex-col items-center gap-1.5 rounded-app border px-3 py-3 text-center shadow-app transition-colors ${shell} ${
          interactive ? 'cursor-pointer hover:border-red-brand' : ''
        }`}
      >
        <span
          className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold ${
            holderName ? 'bg-red-brand/15 text-red-deep' : 'bg-surface-2 text-text-dim'
          }`}
        >
          {initials ?? <PersonIcon />}
        </span>

        <span className="w-full truncate text-[11px] leading-tight text-text-dim">
          {holderName ?? (node.occupancyFr || t('common.org.vacantPosition'))}
        </span>
        <span className="w-full text-sm font-medium leading-snug text-text">{node.titleFr}</span>

        {subtitle && (
          <span className="w-full truncate text-[10px] uppercase tracking-wide text-text-dim">{subtitle}</span>
        )}
        {badge && (
          <span className="mt-0.5 rounded-full bg-red-brand/10 px-2 py-0.5 text-[10px] font-medium text-red-brand">
            {badge}
          </span>
        )}
      </Tag>
    </motion.div>
  );
});

/**
 * Solid block colours for `variant="unit"`, matching the printed organigramme: a red
 * "Direction Générale" apex, olive-green directions, peach structures, grey cellules.
 */
const UNIT_TONE = {
  'direction-general': { shell: 'bg-[#a01824] text-white', subtitle: 'text-white/75' },
  direction: { shell: 'bg-[#7a8b3f] text-white', subtitle: 'text-white/75' },
  structure: { shell: 'bg-[#f5c9a0] text-[#5c3a1e]', subtitle: 'text-[#5c3a1e]/70' },
  cellule: { shell: 'bg-[#d9d9d9] text-[#3a3a3a]', subtitle: 'text-[#3a3a3a]/70' },
};

function Branch({ node, depth, ...shared }) {
  const { toneOf, subtitleOf, badgeOf, onSelect, reduce, variant, line } = shared;
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <li className="relative flex flex-col items-center" data-org-depth={depth}>
      {/* riser into this card, drawn for every node except the root row */}
      {depth > 0 && <span className={`h-5 w-px border-l ${line}`} aria-hidden />}

      <OrgNodeCard
        node={node}
        tone={toneOf?.(node)}
        subtitle={subtitleOf?.(node)}
        badge={badgeOf?.(node)}
        onSelect={onSelect}
        reduce={reduce}
        variant={variant}
      />

      {hasChildren && (
        <>
          {/* stem out of this card */}
          <span className={`h-5 w-px border-l ${line}`} aria-hidden />
          <ul className="flex items-start justify-center">
            {children.map((child, index) => {
              const isFirst = index === 0;
              const isLast = index === children.length - 1;
              const isOnly = children.length === 1;

              return (
                <li key={child.id} className="relative flex flex-col items-center px-3">
                  {/*
                    The horizontal rail. A single child needs no rail (the stem and riser
                    already line up); the first and last children carry only the half that
                    points inward, so the rail stops at the outermost cards instead of
                    overhanging them.
                  */}
                  {!isOnly && (
                    <span
                      aria-hidden
                      className={`absolute top-0 h-px border-t ${line} ${
                        isFirst ? 'left-1/2 right-0' : isLast ? 'left-0 right-1/2' : 'left-0 right-0'
                      }`}
                    />
                  )}
                  <Branch node={child} depth={depth + 1} {...shared} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </li>
  );
}

/**
 * @param {object[]} nodes      flat node list ({ id, parentPositionId, titleFr, holder, … })
 * @param {(n) => string} toneOf      optional: 'vacant' | 'flagged' | 'root' | undefined
 *                                    ('direction-general' | 'direction' | 'structure' |
 *                                    'cellule' when `variant="unit"`)
 * @param {(n) => string} subtitleOf  optional small caps line (unit code, etc.)
 * @param {(n) => string} badgeOf     optional pill (e.g. "Intégration 60 %")
 * @param {(n) => void}   onSelect    optional: makes cards clickable
 * @param {string}        variant     'card' (default, staffing charts) | 'unit' (flat
 *                                    solid-colour blocks, the printed organigramme look)
 */
export default function OrgChart({ nodes, toneOf, subtitleOf, badgeOf, onSelect, emptyLabel, variant = 'card' }) {
  const reduce = useReducedMotion();
  const roots = useMemo(() => buildOrgTree(nodes ?? []), [nodes]);

  if (roots.length === 0) {
    return (
      <p className="rounded-app border border-dashed border-border py-10 text-center text-sm text-text-dim">
        {emptyLabel ?? 'Aucun poste à afficher.'}
      </p>
    );
  }

  // The printed organigramme's connectors read as warm orange/teal, not the neutral
  // border colour the staffing cards use — kept to the 'unit' variant only.
  const line = variant === 'unit' ? 'border-[#d98c3a]/70' : LINE;
  const shared = { toneOf, subtitleOf, badgeOf, onSelect, reduce, variant, line };

  return (
    // The chart is as wide as the widest level; the scroll container is the caller's.
    <div className="inline-flex min-w-full justify-center px-2 pb-2">
      <ul className="flex items-start justify-center gap-8">
        {roots.map((root) => (
          <Branch key={root.id} node={root} depth={0} {...shared} />
        ))}
      </ul>
    </div>
  );
}
