import type { ReactNode } from "react";

interface TableToolbarProps {
  heading: string;
  /** Short status beside the heading, e.g. "13 on record" or "2 results for “john”". */
  meta?: string;
  /** Right-aligned controls, e.g. the Add Transaction button. */
  actions?: ReactNode;
}

/**
 * The bar directly above the table: page heading and record count on the
 * left, actions on the right. Used by TransactionTable and by App's loading
 * and error states, so the page keeps the same shape in every state.
 */
export default function TableToolbar({ heading, meta, actions }: TableToolbarProps) {
  return (
    <div className="table-toolbar">
      <div className="table-toolbar-title">
        <h1 className="section-heading">{heading}</h1>
        {meta && <span className="section-heading-meta">{meta}</span>}
      </div>
      {actions}
    </div>
  );
}
