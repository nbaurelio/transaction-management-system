import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { STATUS_FILTERS, type StatusFilter, type Transaction } from "../types/transaction";
import { formatCurrency } from "../utils/currency";
import { accountMatchRanges, matchesSearch, nameMatchRanges, type Range } from "../utils/search";
import StatusBadge from "./StatusBadge";
import TableToolbar from "./TableToolbar";
import "./TransactionTable.css";

type SortField = "transactionDate" | "amount";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

/** Wraps each matched range of `text` in a <mark>. */
function highlight(text: string, ranges: Range[]) {
  if (ranges.length === 0) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="search-highlight">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function closePopover(ref: RefObject<HTMLDetailsElement | null>) {
  if (ref.current) ref.current.open = false;
}

const optionClass = (active: boolean) => `status-filter-option${active ? " status-filter-option--active" : ""}`;

interface TransactionTableProps {
  transactions: Transaction[];
  searchQuery: string;
  /** Just-added transaction: brought into view (page + filter adjusted). */
  newTransaction?: Transaction | null;
  /** Start the new row's highlight (false while the success popup covers the table). */
  highlightNew?: boolean;
  /** Right side of the toolbar (the Add Transaction button). */
  actions?: ReactNode;
}

export default function TransactionTable({
  transactions,
  searchQuery,
  newTransaction,
  highlightNew = true,
  actions,
}: TransactionTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const filterPopoverRef = useRef<HTMLDetailsElement>(null);
  const pageSizePopoverRef = useRef<HTMLDetailsElement>(null);
  const newRowRef = useRef<HTMLTableRowElement>(null);
  // The new transaction already brought into view, so it's only done once.
  const [shownNew, setShownNew] = useState<Transaction | null>(null);

  // Scroll the new row into view once its page is showing.
  useEffect(() => {
    if (!shownNew) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    newRowRef.current?.scrollIntoView({ block: "nearest", behavior: smooth ? "smooth" : "auto" });
  }, [shownNew]);

  // Close the dropdown menus on an outside click or Escape.
  useEffect(() => {
    const popovers = [filterPopoverRef, pageSizePopoverRef];
    function closeAll(except?: Node) {
      for (const ref of popovers) {
        if (ref.current?.open && !(except && ref.current.contains(except))) closePopover(ref);
      }
    }
    function handlePointerDown(event: PointerEvent) {
      closeAll(event.target as Node);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAll();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // A new search goes back to page 1 (set during render to avoid a stale frame).
  const [lastSearchQuery, setLastSearchQuery] = useState(searchQuery);
  if (searchQuery !== lastSearchQuery) {
    setLastSearchQuery(searchQuery);
    setCurrentPage(1);
  }

  if (transactions.length === 0) {
    return (
      <div className="transaction-table-wrapper">
        <TableToolbar heading="All transactions" count={0} actions={actions} />
        <p className="transaction-table-empty">No transactions yet. Add one to get started.</p>
      </div>
    );
  }

  // Search -> status filter -> sort -> page.
  const trimmedQuery = searchQuery.trim();
  const searched = transactions.filter((t) => matchesSearch(t, searchQuery));
  const filtered = statusFilter === "All" ? searched : searched.filter((t) => t.status === statusFilter);
  // Unsorted keeps the server's (insertion) order.
  const sorted = sortField
    ? [...filtered].sort((a, b) => {
        const diff =
          sortField === "amount" ? a.amount - b.amount : a.transactionDate.localeCompare(b.transactionDate);
        return sortDirection === "asc" ? diff : -diff;
      })
    : filtered;

  // Bring a just-added transaction into view: clear a filter that hides it,
  // then go to its page (set during render, like the search reset above).
  if (newTransaction && newTransaction !== shownNew) {
    if (statusFilter !== "All" && newTransaction.status !== statusFilter) {
      setStatusFilter("All");
    } else {
      const index = sorted.indexOf(newTransaction);
      if (index !== -1) setCurrentPage(Math.floor(index / pageSize) + 1);
      setShownNew(newTransaction);
    }
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages); // clamp after the list shrinks
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  }

  function sortIndicator(field: SortField) {
    const isActive = sortField === field;
    const arrow = isActive ? (sortDirection === "asc" ? "▲" : "▼") : "⇅";
    return (
      <span className={`sort-indicator${isActive ? " sort-indicator--active" : ""}`} aria-hidden="true">
        {arrow}
      </span>
    );
  }

  // Counts follow the current search.
  const countFor = (filter: StatusFilter) =>
    filter === "All" ? searched.length : searched.filter((t) => t.status === filter).length;

  return (
    <div className="transaction-table-wrapper">
      <TableToolbar
        heading={statusFilter === "All" ? "All transactions" : `${statusFilter} transactions`}
        count={sorted.length}
        meta={trimmedQuery ? `matching “${trimmedQuery}”` : undefined}
        actions={actions}
      />

      <div className="transaction-table-scroll">
        <table className="transaction-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="sortable-header" onClick={() => handleSort("transactionDate")}>
                  Transaction Date {sortIndicator("transactionDate")}
                </button>
              </th>
              <th>Account Number</th>
              <th>Account Holder Name</th>
              <th className="transaction-table-amount">
                <button type="button" className="sortable-header" onClick={() => handleSort("amount")}>
                  Amount {sortIndicator("amount")}
                </button>
              </th>
              <th className="transaction-table-status">
                <div className="status-column-header">
                  <span>Status</span>
                  <details className="status-filter-popover" ref={filterPopoverRef}>
                    <summary aria-label="Filter by status" title="Filter by status">
                      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
                        <path
                          d="M2 3h12l-4.5 5.5v4l-3 1.5v-5.5L2 3z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {statusFilter !== "All" && <span className="status-filter-active-dot" aria-hidden="true" />}
                    </summary>
                    <div className="status-filter-menu" role="menu">
                      {STATUS_FILTERS.map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          role="menuitemradio"
                          aria-checked={statusFilter === filter}
                          className={optionClass(statusFilter === filter)}
                          onClick={() => {
                            setStatusFilter(filter);
                            setCurrentPage(1);
                            closePopover(filterPopoverRef);
                          }}
                        >
                          {filter} <span className="status-filter-option-count">{countFor(filter)}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="transaction-table-empty">
                  {trimmedQuery
                    ? `No ${statusFilter === "All" ? "" : `${statusFilter.toLowerCase()} `}transactions match “${trimmedQuery}”.`
                    : `No ${statusFilter.toLowerCase()} transactions.`}
                </td>
              </tr>
            ) : (
              paginated.map((transaction, localIndex) => {
                // Fields aren't unique on their own, so the row position is part of the key.
                const globalIndex = (safePage - 1) * pageSize + localIndex;
                return (
                  <tr
                    key={`${transaction.accountNumber}-${transaction.transactionDate}-${globalIndex}`}
                    ref={transaction === newTransaction ? newRowRef : undefined}
                    className={transaction === newTransaction && highlightNew ? "transaction-row--new" : undefined}
                  >
                    <td>{transaction.transactionDate}</td>
                    <td>{highlight(transaction.accountNumber, accountMatchRanges(transaction.accountNumber, searchQuery))}</td>
                    <td>
                      {highlight(transaction.accountHolderName, nameMatchRanges(transaction.accountHolderName, searchQuery))}
                    </td>
                    <td className="transaction-table-amount">{formatCurrency(transaction.amount)}</td>
                    <td className="transaction-table-status">
                      <StatusBadge status={transaction.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Always shown when there are rows, so a large page size can be changed back. */}
      {sorted.length > 0 && (
        <div className="table-pagination">
          <div className="table-page-size">
            <span>Rows per page</span>
            <details className="page-size-popover" ref={pageSizePopoverRef}>
              <summary aria-label={`Rows per page: ${pageSize}`}>
                {pageSize}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="status-filter-menu page-size-menu" role="menu">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    role="menuitemradio"
                    aria-checked={pageSize === size}
                    className={optionClass(pageSize === size)}
                    onClick={() => {
                      setPageSize(size);
                      setCurrentPage(1);
                      closePopover(pageSizePopoverRef);
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </details>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination-nav">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                disabled={safePage === 1}
              >
                Previous
              </button>
              <span className="table-pagination-label">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
