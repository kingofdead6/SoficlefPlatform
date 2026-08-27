import { StatusBadge } from '@/components/ui';
import type { PositionNode } from '@/infrastructure/repositories/position-repository';
import { cn } from '@/lib/cn';

/**
 * The org chart, as a nested list of posts.
 *
 * A nested `<ul>` rather than an SVG or a grid of absolutely-positioned boxes: the tree
 * *is* a hierarchy, and a screen reader announcing "list, 3 items, nested" conveys that
 * for free. An SVG would need every relationship restated in ARIA, and would not reflow on
 * a phone.
 *
 * Indentation stops compounding after a few levels, for the same reason the organization
 * tree caps it: the inset otherwise pushes deep labels off a narrow screen, and the page
 * must never scroll sideways.
 */

const MAX_INDENT_LEVEL = 4;

export interface TreeNode extends PositionNode {
  children: TreeNode[];
}

/** Builds the forest from a flat list. Nodes whose parent is absent become roots. */
export function buildPositionForest(nodes: PositionNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(
    nodes.map((node) => [node.id, { ...node, children: [] }]),
  );
  const roots: TreeNode[] = [];

  for (const node of byId.values()) {
    const parent = node.parentPositionId ? byId.get(node.parentPositionId) : undefined;
    /*
     * A node whose parent is outside the visible slice is shown as a root rather than
     * dropped. The window a collaborator sees is deliberately partial, so "my manager's
     * manager" is often the topmost thing they can see — hiding it because its own parent
     * is invisible would leave the branch dangling.
     */
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function PositionTree({
  nodes,
  highlightId,
  level = 1,
}: {
  nodes: TreeNode[];
  /** The viewer's own post, marked so they can find themselves in the chart. */
  highlightId?: string | null;
  level?: number;
}) {
  if (nodes.length === 0) return null;

  const indented = level > 1 && level <= MAX_INDENT_LEVEL;
  const nested = level > MAX_INDENT_LEVEL;

  return (
    <ul
      className={cn(
        'space-y-2',
        indented && 'mt-2 border-s border-(--border) ps-4',
        nested && 'mt-2 border-s border-(--border) ps-2',
      )}
    >
      {nodes.map((node) => {
        const isMe = highlightId != null && node.id === highlightId;

        return (
          <li key={node.id}>
            <div
              className={cn(
                'rounded-(--radius) border px-4 py-3',
                isMe
                  ? 'border-(--red-brand) bg-(--red-dim)'
                  : 'border-(--border) bg-(--surface)',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-text text-[13px] font-medium">{node.titleFr}</p>
                  <p className="text-text-muted mt-0.5 text-[12px]">
                    {node.holder
                      ? node.holder.displayName
                      : (node.occupancyFr ?? 'Poste vacant')}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isMe ? <StatusBadge label="Vous" tone="brand" /> : null}
                  {node.isVacant ? <StatusBadge label="Vacant" tone="red" /> : null}
                </div>
              </div>
            </div>

            <PositionTree nodes={node.children} highlightId={highlightId} level={level + 1} />
          </li>
        );
      })}
    </ul>
  );
}
