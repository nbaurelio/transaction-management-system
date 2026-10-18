import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { NewTransactionInput } from "../types/transaction";
import { formatCurrency } from "../utils/currency";
import {
  deletionFrom,
  formatAccountNumber,
  formatDateInput,
  isValidIsoDate,
  localToday,
  maskAmount,
  parseAmount,
  sanitizeAccountHolderName,
} from "../utils/inputMasks";
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

// Client-side checks for instant feedback; the backend validates again.
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.transactionDate) {
    errors.transactionDate = "Transaction date is required.";
  } else if (!isValidIsoDate(form.transactionDate)) {
    errors.transactionDate = "Enter a valid date in YYYY-MM-DD format (e.g. 2025-03-15).";
  } else if (form.transactionDate > localToday()) {
    errors.transactionDate = "Transaction date can't be in the future.";
  }

  const accountDigits = form.accountNumber.replace(/\D/g, "");
  if (!accountDigits) {
    errors.accountNumber = "Account number is required.";
  } else if (accountDigits.length !== 12) {
    errors.accountNumber = "Account number must be a 12-digit number (e.g. 1234-5678-9012).";
  }

  if (!form.accountHolderName.trim()) {
    errors.accountHolderName = "Account holder name is required.";
  }

  const amount = parseAmount(form.amount);
  if (!form.amount.trim()) {
    errors.amount = "Amount is required.";
  } else if (Number.isNaN(amount)) {
    errors.amount = "Amount must be a number.";
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  return errors;
}

export default function AddTransactionModal({ onClose, onSubmit }: AddTransactionModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // "edit" shows the form; "review" shows a summary to confirm before saving.
  const [step, setStep] = useState<"edit" | "review">("edit");
  const headingId = useId();
  const errorIdPrefix = useId();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const pendingAmountCaret = useRef<number | null>(null);

  // Restore the amount cursor after React re-renders the masked value.
  // Runs every render: a rejected keystroke leaves the value unchanged.
  useLayoutEffect(() => {
    const input = amountInputRef.current;
    if (pendingAmountCaret.current === null || !input) return;
    input.setSelectionRange(pendingAmountCaret.current, pendingAmountCaret.current);
    pendingAmountCaret.current = null;
  });

  // Escape: back from the review, or close from the form. Ignored while saving.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || submitting) return;
      if (step === "review") {
        setStep("edit");
      } else {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting, step]);

  useEffect(() => {
    if (step === "review") confirmButtonRef.current?.focus();
  }, [step]);

  // The visible date field is text (always YYYY-MM-DD); this opens a hidden
  // native date input just for its calendar.
  function openCalendar() {
    try {
      datePickerRef.current?.showPicker();
    } catch {
      // No showPicker() support: typing still works.
    }
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [field]: value }));
    // Clear the field's error as soon as it's edited.
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitError(null);
    setStep("review");
  }

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({
        transactionDate: form.transactionDate,
        accountNumber: form.accountNumber.trim(),
        accountHolderName: form.accountHolderName.trim(),
        amount: parseAmount(form.amount),
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to add transaction. Please try again.");
      setSubmitting(false);
    }
  }

  function fieldProps(field: keyof FormState) {
    const hasError = Boolean(fieldErrors[field]);
    return {
      "aria-invalid": hasError,
      "aria-describedby": hasError ? `${errorIdPrefix}-${field}` : undefined,
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
        <h2 id={headingId}>{step === "review" ? "Confirm transaction" : "Add Transaction"}</h2>

        {step === "review" ? (
          <div className="modal-review">
            <p className="modal-review-intro">
              Please review the details below. Once recorded, a transaction can't be edited, and its status is
              assigned automatically.
            </p>
            <dl className="modal-review-list">
              <div>
                <dt>Transaction date</dt>
                <dd>{form.transactionDate}</dd>
              </div>
              <div>
                <dt>Account number</dt>
                <dd>{form.accountNumber}</dd>
              </div>
              <div>
                <dt>Account holder</dt>
                <dd>{form.accountHolderName.trim()}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd className="modal-review-amount">{formatCurrency(parseAmount(form.amount))}</dd>
              </div>
            </dl>

            {submitError && (
              <p className="modal-error" role="alert">
                {submitError}
              </p>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setSubmitError(null);
                  setStep("edit");
                }}
                disabled={submitting}
              >
                Back to edit
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className="button button--primary"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? "Recording..." : "Confirm and record"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className="modal-field">
              Transaction Date
              <div className="modal-date-group">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.transactionDate}
                  onChange={(event) => updateField("transactionDate", formatDateInput(event.target.value))}
                  placeholder="YYYY-MM-DD"
                  {...fieldProps("transactionDate")}
                />
                <button
                  type="button"
                  className="modal-date-trigger"
                  onClick={openCalendar}
                  aria-label="Choose date from calendar"
                  title="Choose date from calendar"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M2 6.5h12M5.5 1.75v2.5M10.5 1.75v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
                <input
                  ref={datePickerRef}
                  type="date"
                  className="modal-date-picker"
                  value={isValidIsoDate(form.transactionDate) ? form.transactionDate : ""}
                  max={localToday()}
                  onChange={(event) => updateField("transactionDate", event.target.value)}
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
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
                {/* Text, not type="number": the mask needs the cursor position. */}
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => {
                    const { value, caret } = maskAmount(
                      event.target.value,
                      event.target.selectionStart ?? event.target.value.length,
                      form.amount,
                      deletionFrom((event.nativeEvent as InputEvent).inputType),
                    );
                    pendingAmountCaret.current = caret;
                    updateField("amount", value);
                  }}
                  placeholder="0.00"
                  {...fieldProps("amount")}
                />
              </div>
              {renderFieldError("amount")}
            </label>

            <div className="modal-actions">
              <button type="button" className="button button--secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="button button--primary">
                Add Transaction
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
