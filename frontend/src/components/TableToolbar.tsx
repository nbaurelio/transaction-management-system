import type { ReactNode } from "react";

interface TableToolbarProps {
  heading: string;
  /** Shown as a small chip beside the heading. Omitted while loading. */
  count?: number;
  /** Extra context after the count, e.g. "matching “john”". */
  meta?: string;
  /** Right-aligned controls, e.g. the Add Transaction button. */
  actions?: ReactNode;
}

/**
 * The top strip of the table card: heading, record count and actions. Used
 * by TransactionTable and by App's loading and error states, so the page
 * keeps the same shape in every state.
 */
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
