import type { TransactionStatus } from "../types/transaction";
import "./StatusBadge.css";

const STATUS_CLASS: Record<TransactionStatus, string> = {
  Pending: "status-badge status-badge--pending",
  Settled: "status-badge status-badge--settled",
  Failed: "status-badge status-badge--failed",
};

export default function StatusBadge({ status }: { status: TransactionStatus }) {
  return <span className={STATUS_CLASS[status]}>{status}</span>;
}
