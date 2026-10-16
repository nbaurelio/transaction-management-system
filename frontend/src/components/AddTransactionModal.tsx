import { useEffect, useId, useState, type FormEvent } from "react";
import type { NewTransactionInput } from "../types/transaction";
import "./AddTransactionModal.css";

interface AddTransactionModalProps {
  onClose: () => void;
  onSubmit: (input: NewTransactionInput) => Promise<void>;
}

interface FormState {
  transactionDate: string;
  accountNumber: string;
  accountHolderName: string;
  amount: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  transactionDate: "",
  accountNumber: "",
  accountHolderName: "",
  amount: "",
};

/** Today as YYYY-MM-DD in the user's local timezone (toISOString() would give the UTC date). */
function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Strips non-digits, caps at 12 digits, and re-inserts a hyphen every 4 digits. */
function formatAccountNumber(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

/** Letters and spaces only, so names like "Jane Doe" stay intact but digits/symbols are dropped. */
function sanitizeAccountHolderName(rawValue: string): string {
  return rawValue.replace(/[^A-Za-z\s]/g, "");
}

// Client-side validation only improves the experience (instant, per-field
// feedback) — the backend re-validates everything independently on submit,
// since a direct API call would bypass this entirely.
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.transactionDate) {
    errors.transactionDate = "Transaction date is required.";
  } else if (form.transactionDate > localToday()) {
    errors.transactionDate = "Transaction date can't be in the future.";
  }

  const accountNumberDigits = form.accountNumber.replace(/\D/g, "");
  if (!accountNumberDigits) {
    errors.accountNumber = "Account number is required.";
  } else if (accountNumberDigits.length !== 12) {
    errors.accountNumber = "Account number must be a 12-digit number (e.g. 1234-5678-9012).";
  }

  if (!form.accountHolderName.trim()) {
    errors.accountHolderName = "Account holder name is required.";
  }

  if (!form.amount.trim()) {
    errors.amount = "Amount is required.";
  } else if (Number.isNaN(Number(form.amount))) {
    errors.amount = "Amount must be a number.";
  } else if (Number(form.amount) <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  return errors;
}

export default function AddTransactionModal({ onClose, onSubmit }: AddTransactionModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const headingId = useId();
  const errorIdPrefix = useId();

  // Escape closes the modal, same as Cancel — and, like Cancel, not while a
  // submit is in flight.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
    // Clear a field's error as soon as the user starts correcting it.
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        transactionDate: form.transactionDate,
        accountNumber: form.accountNumber.trim(),
        accountHolderName: form.accountHolderName.trim(),
        amount: Number(form.amount),
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to add transaction. Please try again.");
      setSubmitting(false);
    }
  }

  function fieldProps(field: keyof FormState) {
    const errorId = `${errorIdPrefix}-${field}`;
    const hasError = Boolean(fieldErrors[field]);
    return {
      "aria-invalid": hasError,
      "aria-describedby": hasError ? errorId : undefined,
      className: hasError ? "has-error" : undefined,
    };
  }

  function renderFieldError(field: keyof FormState) {
    const message = fieldErrors[field];
    if (!message) return null;
    return (
      <span id={`${errorIdPrefix}-${field}`} className="modal-field-error" role="alert">
        {message}
      </span>
    );
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={headingId}>Add Transaction</h2>

        <form onSubmit={handleSubmit} noValidate>
          <label className="modal-field">
            Transaction Date
            <input
              type="date"
              value={form.transactionDate}
              max={localToday()}
              onChange={(event) => updateField("transactionDate", event.target.value)}
              {...fieldProps("transactionDate")}
            />
            {renderFieldError("transactionDate")}
          </label>

          <label className="modal-field">
            Account Number
            <input
              type="text"
              inputMode="numeric"
              value={form.accountNumber}
              onChange={(event) => updateField("accountNumber", formatAccountNumber(event.target.value))}
              placeholder="e.g. 1234-5678-9012"
              {...fieldProps("accountNumber")}
            />
            {renderFieldError("accountNumber")}
          </label>

          <label className="modal-field">
            Account Holder Name
            <input
              type="text"
              value={form.accountHolderName}
              onChange={(event) => updateField("accountHolderName", sanitizeAccountHolderName(event.target.value))}
              placeholder="e.g. Jane Doe"
              {...fieldProps("accountHolderName")}
            />
            {renderFieldError("accountHolderName")}
          </label>

          <label className="modal-field">
            Amount
            <div className="modal-input-prefix-group">
              <span className="modal-input-prefix" aria-hidden="true">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                placeholder="0.00"
                {...fieldProps("amount")}
              />
            </div>
            {renderFieldError("amount")}
          </label>

          {submitError && (
            <p className="modal-error" role="alert">
              {submitError}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button button--secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? "Adding..." : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
