import { useEffect, useState } from "react";
import { createTransaction, fetchTransactions } from "./api/transactions";
import AddTransactionModal from "./components/AddTransactionModal";
import AppHeader from "./components/AppHeader";
import TransactionRecordedPopup from "./components/TransactionRecordedPopup";
import TransactionTable from "./components/TransactionTable";
import type { NewTransactionInput, Transaction } from "./types/transaction";
import "./App.css";

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // null = popup hidden; a string both shows the popup and supplies its text,
  // so there's no separate boolean to keep in sync with the message.
  const [recordedMessage, setRecordedMessage] = useState<string | null>(null);

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
      `Transaction for ${created.accountHolderName} ($${created.amount.toFixed(2)}) was recorded successfully.`,
    );
  }

  return (
    <div className="app">
      <AppHeader />

      <main className="page">
        <div className="page-toolbar">
          <div>
            <h1>Transactions</h1>
            {!loading && !loadError && (
              <p className="page-subtitle">
                {transactions.length} transaction{transactions.length === 1 ? "" : "s"} on record
              </p>
            )}
          </div>

          <button className="button button--primary" onClick={() => setIsModalOpen(true)}>
            + Add Transaction
          </button>
        </div>

        {loading && <p className="page-status">Loading transactions...</p>}

        {!loading && loadError && (
          <div className="load-error">
            <p>{loadError}</p>
            <button className="button button--secondary" onClick={loadTransactions}>
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && <TransactionTable transactions={transactions} />}
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
