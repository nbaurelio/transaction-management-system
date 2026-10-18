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
  // Success popup text; null hides it.
  const [recordedMessage, setRecordedMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Most recently added transaction; the table jumps to and highlights it.
  const [lastAdded, setLastAdded] = useState<Transaction | null>(null);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    setLoading(true);
    setLoadError(null);
    try {
      setTransactions(await fetchTransactions());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }

  // Errors propagate to the modal, which shows them and stays open.
  async function handleAddTransaction(input: NewTransactionInput) {
    const created = await createTransaction(input);
    setTransactions((previous) => [...previous, created]);
    setLastAdded(created);
    setSearchQuery(""); // a search could hide the new row
    setIsModalOpen(false);
    setRecordedMessage(
      `The transaction for ${created.accountHolderName} (${formatCurrency(created.amount)}) has been recorded with status ${created.status}.`,
    );
  }

  // "+" that expands to show its label on hover/focus (see .button--expand).
  const addButton = (
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
          <TransactionTable
            transactions={transactions}
            searchQuery={searchQuery}
            newTransaction={lastAdded}
            highlightNew={recordedMessage === null}
            actions={addButton}
          />
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
