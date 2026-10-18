import type { ReactNode } from "react";

interface TableToolbarProps {
  heading: string;
  /** Count chip; omitted while loading. */
  count?: number;
  /** Text after the count, e.g. "matching “john”". */
  meta?: string;
  /** Right side, e.g. the Add Transaction button. */
  actions?: ReactNode;
}

/** Heading, count and actions above the table. Also used while loading or on error. */
export default function TableToolbar({ heading, count, meta, actions }: TableToolbarProps) {
  return (
    <div className="table-toolbar">
      <div className="table-toolbar-title">
        <h1 className="section-heading">{heading}</h1>
        {count !== undefined && (
          <span className="table-count" aria-label={`${count} transaction${count === 1 ? "" : "s"}`}>
            {count}
          </span>
        )}
        {meta && <span className="section-heading-meta">{meta}</span>}
      </div>
      {actions}
    </div>
  );
}
