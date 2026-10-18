import { useEffect, useState } from "react";
import { createTransaction, fetchTransactions } from "./api/transactions";
import AddTransactionModal from "./components/AddTransactionModal";
import AppHeader from "./components/AppHeader";
import TableSkeleton from "./components/TableSkeleton";
import TableToolbar from "./components/TableToolbar";
import TransactionRecordedPopup from "./components/TransactionRecordedPopup";
import TransactionTable from "./components/TransactionTable";
import type { NewTransactionInput, Transaction } from "./types/transaction";
import { formatCurrency } from "./utils/currency";
import "./App.css";

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // null = popup hidden; a string both shows the popup and supplies its text,
  // so there's no separate boolean to keep in sync with the message.
  const [recordedMessage, setRecordedMessage] = useState<string | null>(null);
  // Lives here rather than in the table because the input is in the header.
  const [searchQuery, setSearchQuery] = useState("");

  // Empty deps array: fetch once when the app mounts, not on every re-render.
  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchTransactions();
      setTransactions(data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }

  // Called by AddTransactionModal's onSubmit. If createTransaction throws, this
  // function throws too — the modal's own try/catch is what shows the error and
  // keeps the modal open, so there's nothing to catch here.
  async function handleAddTransaction(input: NewTransactionInput) {
    const created = await createTransaction(input);
    setTransactions((previous) => [...previous, created]);
    setIsModalOpen(false);
    setRecordedMessage(
      `The transaction for ${created.accountHolderName} (${formatCurrency(created.amount)}) has been recorded with status ${created.status}.`,
    );
  }

  const addButton = (
    // Compact "+" that widens to reveal its label on hover/keyboard focus
    // (always shown on touch screens) — see .button--expand in App.css.
    <button className="button button--primary button--expand" onClick={() => setIsModalOpen(true)}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <span className="button-label">Add Transaction</span>
    </button>
  );

  return (
    <div className="app">
      <AppHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <main className="page">
        {(loading || loadError) && <TableToolbar heading="All transactions" actions={addButton} />}

        {loading && <TableSkeleton />}

        {!loading && loadError && (
          <div className="load-error">
            <p>{loadError}</p>
            <button className="button button--secondary" onClick={loadTransactions}>
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <TransactionTable transactions={transactions} searchQuery={searchQuery} actions={addButton} />
        )}
      </main>

      {isModalOpen && (
        <AddTransactionModal onClose={() => setIsModalOpen(false)} onSubmit={handleAddTransaction} />
      )}

      {recordedMessage && (
        <TransactionRecordedPopup message={recordedMessage} onClose={() => setRecordedMessage(null)} />
      )}
    </div>
  );
}
