import { useEffect, useRef, useState, type ReactNode } from "react";
import { STATUS_FILTERS, type StatusFilter, type Transaction } from "../types/transaction";
import { formatCurrency } from "../utils/currency";
import StatusBadge from "./StatusBadge";
import TableToolbar from "./TableToolbar";
import "./TransactionTable.css";

type SortField = "transactionDate" | "amount";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

/**
 * Case-insensitive match on account holder name, or on account number with
 * hyphens ignored — so "11223456" finds "1122-3456-7890" as well as "1122-34".
 */
function matchesSearch(transaction: Transaction, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  if (transaction.accountHolderName.toLowerCase().includes(normalizedQuery)) return true;
  const queryDigits = normalizedQuery.replace(/-/g, "");
  return queryDigits !== "" && transaction.accountNumber.replace(/-/g, "").includes(queryDigits);
}

type Range = [start: number, end: number];

/** Every non-overlapping occurrence of `needle` in `haystack`, as [start, end) ranges. */
function findOccurrences(haystack: string, needle: string): Range[] {
  const ranges: Range[] = [];
  if (!needle) return ranges;
  let from = 0;
  let index: number;
  while ((index = haystack.indexOf(needle, from)) !== -1) {
    ranges.push([index, index + needle.length]);
    from = index + needle.length;
  }
  return ranges;
}

/** Where the search matches a name — case-insensitive, same rule as matchesSearch. */
function nameMatchRanges(name: string, query: string): Range[] {
  return findOccurrences(name.toLowerCase(), query.trim().toLowerCase());
}

/**
 * Where the search matches an account number. Matching ignores hyphens
 * (as in matchesSearch), so the search runs on the digits alone and each hit
 * is mapped back onto the formatted number — a range can span a hyphen, e.g.
 * "11223456" highlights "1122-3456" in "1122-3456-7890".
 */
function accountMatchRanges(accountNumber: string, query: string): Range[] {
  const queryDigits = query.trim().toLowerCase().replace(/-/g, "");
  const positions: number[] = []; // index in accountNumber of each non-hyphen char
  let stripped = "";
  for (let i = 0; i < accountNumber.length; i++) {
    if (accountNumber[i] !== "-") {
      positions.push(i);
      stripped += accountNumber[i];
    }
  }
  return findOccurrences(stripped, queryDigits).map(([start, end]) => [positions[start], positions[end - 1] + 1]);
}

/** Renders `text` with each range wrapped in a <mark>. */
function highlight(text: string, ranges: Range[]) {
  if (ranges.length === 0) return text;
  const parts = [];
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

interface TransactionTableProps {
  transactions: Transaction[];
  searchQuery: string;
  /** Shown at the right of the toolbar above the table (the Add Transaction button). */
  actions?: ReactNode;
}

export default function TransactionTable({ transactions, searchQuery, actions }: TransactionTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const filterPopoverRef = useRef<HTMLDetailsElement>(null);
  const pageSizePopoverRef = useRef<HTMLDetailsElement>(null);

  // <details> menus only close when their own summary is clicked. Close them
  // on a click anywhere else, or on Escape, like a typical dropdown.
  useEffect(() => {
    const popovers = [filterPopoverRef, pageSizePopoverRef];
    function closeAll(except?: Node) {
      for (const ref of popovers) {
        if (ref.current?.open && !(except && ref.current.contains(except))) {
          ref.current.open = false;
        }
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

  // The search box lives in the header, outside this component, so a new
  // query is noticed here and sends the table back to page 1 — the same as
  // a filter or sort change. Adjusting state during render (rather than in
  // an effect) avoids a render showing the stale page first.
  const [lastSearchQuery, setLastSearchQuery] = useState(searchQuery);
  if (searchQuery !== lastSearchQuery) {
    setLastSearchQuery(searchQuery);
    setCurrentPage(1);
  }

  if (transactions.length === 0) {
    return (
      <div className="transaction-table-wrapper">
        <TableToolbar heading="All transactions" meta="0 on record" actions={actions} />
        <p className="transaction-table-empty">No transactions yet. Add one to get started.</p>
      </div>
    );
  }

  // Pipeline: search -> filter by status -> sort -> slice to the current page.
  // Recomputed from scratch on every render instead of memoized — the
  // transaction lists here are small, so the simplicity isn't worth the
  // useMemo bookkeeping.
  const searched = transactions.filter((t) => matchesSearch(t, searchQuery));
  const filtered = statusFilter === "All" ? searched : searched.filter((t) => t.status === statusFilter);
  const trimmedQuery = searchQuery.trim();

  // sortField is null until the user clicks a column header, so the default
  // view keeps the server's original (insertion) order.
  const sorted = sortField
    ? [...filtered].sort((a, b) => {
        const diff =
          sortField === "amount" ? a.amount - b.amount : a.transactionDate.localeCompare(b.transactionDate);
        return sortDirection === "asc" ? diff : -diff;
      })
    : filtered;

  // currentPage can point past the end after the filter/sort above shrinks
  // the result set (e.g. switching to a status with fewer rows while on
  // page 3) — safePage clamps it back into range for this render without
  // needing an effect to "fix up" the state afterwards.
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(field: SortField) {
    if (sortField === field) {
      // clicking the active column again flips direction, like a typical spreadsheet
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

  function selectFilter(filter: StatusFilter) {
    setStatusFilter(filter);
    setCurrentPage(1);
  }

  // Counts follow the search, so the filter menu shows what each option
  // would actually leave on screen.
  function countFor(filter: StatusFilter) {
    return filter === "All" ? searched.length : searched.filter((t) => t.status === filter).length;
  }

  return (
    <div className="transaction-table-wrapper">
      <TableToolbar
        heading={statusFilter === "All" ? "All transactions" : `${statusFilter} transactions`}
        meta={
          trimmedQuery
            ? `${sorted.length} result${sorted.length === 1 ? "" : "s"} for “${trimmedQuery}”`
            : `${sorted.length} on record`
        }
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
                          className={`status-filter-option${statusFilter === filter ? " status-filter-option--active" : ""}`}
                          onClick={() => {
                            selectFilter(filter);
                            // Close the popover after a selection, same as a
                            // typical menu — <details> otherwise stays open.
                            if (filterPopoverRef.current) {
                              filterPopoverRef.current.open = false;
                            }
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
                // None of the fields are guaranteed unique on their own (same
                // account can appear on the same date more than once), so the
                // row's position in the full sorted/filtered list is folded
                // into the key as a tiebreaker.
                const globalIndex = (safePage - 1) * pageSize + localIndex;
                return (
                  <tr key={`${transaction.accountNumber}-${transaction.transactionDate}-${globalIndex}`}>
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

      {/* Shown whenever there are rows, not only when there's more than one
          page — otherwise picking a large page size would hide the very
          dropdown needed to switch back to a smaller one. */}
      {sorted.length > 0 && (
        <div className="table-pagination">
          {/* A custom menu rather than a native <select>, whose open list
              can't be styled — this reuses the Status filter's menu styles
              so the two dropdowns match. */}
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
                    className={`status-filter-option${pageSize === size ? " status-filter-option--active" : ""}`}
                    onClick={() => {
                      setPageSize(size);
                      setCurrentPage(1);
                      if (pageSizePopoverRef.current) {
                        pageSizePopoverRef.current.open = false;
                      }
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
