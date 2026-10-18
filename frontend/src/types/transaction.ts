// Must match the backend's status labels exactly.
export type TransactionStatus = "Pending" | "Settled" | "Failed";

// "All" is UI-only: no filter.
export type StatusFilter = "All" | TransactionStatus;

export const STATUS_FILTERS: StatusFilter[] = ["All", "Pending", "Settled", "Failed"];

export interface Transaction {
  transactionDate: string; // YYYY-MM-DD
  accountNumber: string;
  accountHolderName: string;
  amount: number;
  status: TransactionStatus;
}

/** Form input for a new transaction; the server assigns the status. */
export interface NewTransactionInput {
  transactionDate: string;
  accountNumber: string;
  accountHolderName: string;
  amount: number;
}
