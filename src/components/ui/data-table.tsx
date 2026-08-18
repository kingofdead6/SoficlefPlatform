import { cn } from '@/lib/cn';

/**
 * A tabular view.
 *
 * Wide tables scroll inside their own container rather than pushing the page sideways —
 * which matters more in Arabic, where a horizontal overflow fights the reading direction.
 * Column alignment is logical (`start`/`end`), never physical, so the table mirrors.
 */
export interface Column<Row> {
  key: string;
  header: string;
  /** `end` for figures; the rest read from the start edge. */
  align?: 'start' | 'end';
  /** Monospace the cell — codes, extensions, percentages. */
  mono?: boolean;
  render: (row: Row) => React.ReactNode;
}

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  emptyLabel,
  caption,
  className,
}: {
  columns: Column<Row>[];
  rows: Row[];
  getRowKey: (row: Row, index: number) => string;
  emptyLabel: string;
  /** Describes the table to a screen reader; visually hidden. */
  caption: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-(--radius) border border-(--border)', className)}>
      <table className="w-full border-collapse bg-(--surface) text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-(--blue-dim)">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'text-blue border-b border-(--border) px-3 py-2.5 text-[11px] font-semibold tracking-wide uppercase',
                  column.align === 'end' ? 'text-end' : 'text-start',
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-text-dim px-3 py-8 text-center text-[13px]"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={getRowKey(row, index)} className="even:bg-(--surface2)/60">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'text-text border-b border-(--border) px-3 py-2.5',
                      column.align === 'end' ? 'text-end' : 'text-start',
                      column.mono && 'font-mono tabular-nums',
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
