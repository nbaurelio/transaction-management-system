// Must match TransactionStatus.getLabel() values on the backend exactly —
// that's the literal string the API sends over the wire for `status`.
export type TransactionStatus = "Pending" | "Settled" | "Failed";

// "All" isn't a real backend status — it's the UI-only option meaning "don't filter".
export type StatusFilter = "All" | TransactionStatus;

export const STATUS_FILTERS: StatusFilter[] = ["All", "Pending", "Settled", "Failed"];

export interface Transaction {
  transactionDate: string; // YYYY-MM-DD
  accountNumber: string;
  accountHolderName: string;
  amount: number;
  status: TransactionStatus;
}

/** Fields the user supplies via the "Add Transaction" form. Status is assigned by the server. */
export interface NewTransactionInput {
  transactionDate: string;
  accountNumber: string;
  accountHolderName: string;
  amount: number;
}
