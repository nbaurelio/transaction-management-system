import type { NewTransactionInput, Transaction } from "../types/transaction";

// Override with VITE_API_BASE_URL; defaults to the local backend.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/** Error body from the backend is { message, details }; fall back to the status code. */
async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.message) return body.message;
  } catch {
    // Not JSON.
  }
  return `Request failed with status ${response.status}`;
}

/** Calls /transactions. Errors are thrown with a message ready to show the user. */
async function request<T>(init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/transactions`, init);
  } catch {
    // fetch() only rejects when the server can't be reached.
    throw new Error("Could not reach the server. Is the backend running?");
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export function fetchTransactions(): Promise<Transaction[]> {
  return request<Transaction[]>();
}

export function createTransaction(input: NewTransactionInput): Promise<Transaction> {
  return request<Transaction>({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
