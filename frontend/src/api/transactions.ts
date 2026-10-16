import type { NewTransactionInput, Transaction } from "../types/transaction";

// Lets the API URL be overridden per environment (e.g. a deployed build)
// without a code change; falls back to the local backend for dev.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

// A distinct error type (rather than throwing a plain string/Error) so
// components can show err.message directly as a user-facing string, instead
// of a generic "something went wrong".
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// The backend's error body is { message, details, ... } (see ApiError.java) —
// this pulls out just the message, falling back to the HTTP status if the
// body isn't JSON (e.g. a 502 from a proxy with no backend involved at all).
async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.message) {
      return body.message;
    }
  } catch {
    // response had no JSON body; fall through to the generic message
  }
  return `Request failed with status ${response.status}`;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  let response: Response;
  try {
    // fetch() itself only rejects on a network-level failure (server down,
    // DNS, CORS) — a 4xx/5xx response still resolves normally, which is why
    // that case is checked separately below via response.ok.
    response = await fetch(`${API_BASE_URL}/transactions`);
  } catch {
    throw new ApiError("Could not reach the server. Is the backend running?");
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response));
  }

  return response.json();
}

export async function createTransaction(input: NewTransactionInput): Promise<Transaction> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Could not reach the server. Is the backend running?");
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorMessage(response));
  }

  return response.json();
}
