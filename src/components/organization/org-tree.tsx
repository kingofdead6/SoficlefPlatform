import { StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The organizational tree (CDC v0.1 §5.1).
 *
 * Built from nested `<ul>`/`<li>` rather than positioned boxes, so the hierarchy is real
 * to a screen reader — "list, 3 items, level 2" — and mirrors in Arabic for free, since
 * the indentation is `padding-inline-start` and the connector sits on the inline-start
 * edge. A canvas-drawn org chart would convey none of that.
 */

export interface OrgNode {
  id: string;
  code: string;
  nameFr: string;
  type: string;
  headLabelFr: string | null;
  headOccupancy: 'VACANT' | 'TO_FILL' | 'OCCUPIED' | null;
  descriptionFr: string | null;
  children: OrgNode[];
}

const OCCUPANCY = {
  VACANT: { label: 'Poste vacant', tone: 'red' as const },
  TO_FILL: { label: 'À pourvoir', tone: 'gold' as const },
  OCCUPIED: { label: 'Pourvu', tone: 'green' as const },
};

const TYPE_LABEL: Record<string, string> = {
  DIRECTION: 'Direction',
  STRUCTURE: 'Structure',
  UNITE_PRODUCTION: 'Unité de production',
  CELLULE: 'Cellule fonctionnelle',
  SERVICE: 'Service',
};

/** Turns a flat list into a forest, preserving order and keeping orphans visible. */
export function buildForest(
  units: {
    id: string;
    code: string;
    nameFr: string;
    type: string;
    parentId: string | null;
    headLabelFr: string | null;
    headOccupancy: 'VACANT' | 'TO_FILL' | 'OCCUPIED' | null;
    descriptionFr: string | null;
  }[],
): OrgNode[] {
  const byId = new Map<string, OrgNode>(units.map((unit) => [unit.id, { ...unit, children: [] }]));
  const roots: OrgNode[] = [];

  for (const unit of units) {
    const node = byId.get(unit.id);
    if (!node) continue;
    const parent = unit.parentId ? byId.get(unit.parentId) : undefined;
    // A unit whose parent is out of scope is shown as a root rather than dropped: a
    // manager must still see their own structure even when its parent is not theirs.
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function OrgTree({
  nodes,
  renderActions,
  level = 1,
}: {
  nodes: OrgNode[];
  renderActions?: (node: OrgNode) => React.ReactNode;
  level?: number;
}) {
  if (nodes.length === 0) return null;

  return (
    <ul className={cn('space-y-2', level > 1 && 'mt-2 border-s border-(--border) ps-4')}>
      {nodes.map((node) => (
        <li key={node.id}>
          <div className="rounded-(--radius) border border-(--border) bg-(--surface) px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gold-strong rounded bg-(--gold-dim) px-1.5 py-0.5 font-mono text-[10px]">
                    {node.code}
                  </span>
                  <span className="text-text text-[13px] font-medium">{node.nameFr}</span>
                  <span className="text-text-dim text-[11px]">
                    {TYPE_LABEL[node.type] ?? node.type}
                  </span>
                </div>
                {node.descriptionFr ? (
                  <p className="text-text-muted mt-1 text-[12px] leading-relaxed">
                    {node.descriptionFr}
                  </p>
                ) : null}
                {node.headOccupancy ? (
                  <div className="mt-2">
                    <StatusBadge
                      label={
                        node.headLabelFr
                          ? `${OCCUPANCY[node.headOccupancy].label} · ${node.headLabelFr}`
                          : OCCUPANCY[node.headOccupancy].label
                      }
                      tone={OCCUPANCY[node.headOccupancy].tone}
                    />
                  </div>
                ) : null}
              </div>
              {renderActions ? <div className="shrink-0">{renderActions(node)}</div> : null}
            </div>
          </div>

          <OrgTree nodes={node.children} renderActions={renderActions} level={level + 1} />
        </li>
      ))}
    </ul>
  );
}
