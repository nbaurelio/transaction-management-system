import "./TableSkeleton.css";

const SKELETON_ROWS = 6;

// Bar widths per column, varied row to row so the placeholder reads like
// real data rather than a uniform grid.
const NAME_WIDTHS = ["7.5rem", "6rem", "8.5rem", "6.5rem", "9rem", "7rem"];
const AMOUNT_WIDTHS = ["4rem", "3.25rem", "4.5rem", "3.75rem", "4.25rem", "3.5rem"];

/**
 * Shown while transactions load: the real table frame and headers, with
 * shimmering placeholder bars where the rows will appear, so the page
 * doesn't jump when the data arrives.
 */
export default function TableSkeleton() {
  return (
    <div className="transaction-table-scroll table-skeleton" aria-busy="true">
      <span className="visually-hidden" role="status">
        Loading transactions…
      </span>
      <table className="transaction-table" aria-hidden="true">
        <thead>
          <tr>
            <th>Transaction Date</th>
            <th>Account Number</th>
            <th>Account Holder Name</th>
            <th className="transaction-table-amount">Amount</th>
            <th className="transaction-table-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }, (_, row) => (
            <tr key={row}>
              <td>
                <span className="skeleton-bar" style={{ width: "5.5rem" }} />
              </td>
              <td>
                <span className="skeleton-bar" style={{ width: "7.5rem" }} />
              </td>
              <td>
                <span className="skeleton-bar" style={{ width: NAME_WIDTHS[row] }} />
              </td>
              <td className="transaction-table-amount">
                <span className="skeleton-bar" style={{ width: AMOUNT_WIDTHS[row] }} />
              </td>
              <td className="transaction-table-status">
                <span className="skeleton-bar skeleton-bar--pill" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
