import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
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

/** Strips non-digits, caps at 8, and inserts hyphens as YYYY-MM-DD while typing. */
function formatDateInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** True only for a complete YYYY-MM-DD string that is a real calendar date (rejects 2025-02-30). */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Matches the backend's @Digits(integer = 13) limit on amount. */
const MAX_AMOUNT_WHOLE_DIGITS = 13;

const digitsOnly = (text: string) => text.replace(/\D/g, "");

/**
 * Money mask for the Amount field: once any digit is typed the value always
 * reads as `<whole>.<cents>` ("1" -> "1.00"), and the returned caret keeps
 * typing where the user expects it:
 *   - digits typed in the whole part stay before the point ("12|.00")
 *   - typing "." jumps into the cents
 *   - digits typed in the cents overwrite the zeros ("12.|00" + 5 -> "12.5|0")
 *   - backspacing the point just steps over it; clearing every whole digit
 *     (with zero cents) empties the field so the placeholder shows again
 * `raw`/`caret` are the input's value and cursor right after the keystroke;
 * `previous` is the value before it.
 */
function maskAmount(raw: string, caret: number, previous: string): { value: string; caret: number } {
  // Backspace/Delete removed only the decimal point: keep the value, step over it.
  if (previous.includes(".") && raw === previous.replace(".", "")) {
    return { value: previous, caret: previous.indexOf(".") };
  }
  if (raw === ".") {
    return { value: "0.00", caret: 2 };
  }

  let text = raw;
  let cursor = caret;
  // A second "." means the user pressed "." — drop it and move into the cents.
  if (text.indexOf(".") !== text.lastIndexOf(".")) {
    const typedAt = cursor - 1;
    if (text[typedAt] === ".") {
      text = text.slice(0, typedAt) + text.slice(typedAt + 1);
      cursor = text.indexOf(".") + 1;
    }
    const firstDot = text.indexOf(".");
    text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, "");
  }

  const dot = text.indexOf(".");
  const wholeRaw = dot === -1 ? text : text.slice(0, dot);
  const centsRaw = dot === -1 ? "" : text.slice(dot + 1);
  const caretInWhole = dot === -1 || cursor <= dot;
  let digitsBeforeCaret = caretInWhole
    ? digitsOnly(wholeRaw.slice(0, cursor)).length
    : digitsOnly(centsRaw.slice(0, cursor - dot - 1)).length;

  let whole = digitsOnly(wholeRaw);
  let cents = digitsOnly(centsRaw);

  if (!whole && !/[1-9]/.test(cents)) {
    return { value: "", caret: 0 };
  }
  if (cents.length > 2) {
    // Overtype: the new digit replaces the one after it instead of pushing it along.
    const at = caretInWhole ? 0 : digitsBeforeCaret;
    cents = (cents.slice(0, at) + cents.slice(at + cents.length - 2)).slice(0, 2);
  }
  cents = cents.padEnd(2, "0");

  // A digit typed beside a lone "0" whole part replaces it, whichever side
  // the cursor was on ("0.50" + 3 -> "3.50", never "30.50").
  if (previous.startsWith("0.") && whole.length === 2) {
    const zeroAt = whole.indexOf("0");
    whole = whole.slice(0, zeroAt) + whole.slice(zeroAt + 1);
    if (caretInWhole && zeroAt < digitsBeforeCaret) digitsBeforeCaret -= 1;
  }

  const stripped = whole.replace(/^0+(?=\d)/, "");
  if (caretInWhole) digitsBeforeCaret = Math.max(0, digitsBeforeCaret - (whole.length - stripped.length));
  whole = stripped || "0";
  if (whole.length > MAX_AMOUNT_WHOLE_DIGITS) {
    return { value: previous, caret: Math.max(0, caret - 1) };
  }

  const value = `${whole}.${cents}`;
  if (!caretInWhole) {
    return { value, caret: whole.length + 1 + Math.min(digitsBeforeCaret, 2) };
  }
  // A lone "0" whole part: sit after it, so the next digit replaces it ("0" + 3 -> "3").
  return { value, caret: whole === "0" ? 1 : Math.min(digitsBeforeCaret, whole.length) };
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
  } else if (!isValidIsoDate(form.transactionDate)) {
    errors.transactionDate = "Enter a valid date in YYYY-MM-DD format (e.g. 2025-03-15).";
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
  const datePickerRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const pendingAmountCaret = useRef<number | null>(null);

  // React rewrites the input's value after maskAmount reformats it, which
  // throws the cursor to the end — put it back where the mask said, before
  // the browser paints. No dependency array: a keystroke the mask rejects
  // (e.g. a letter) leaves form.amount unchanged but still needs the fix-up.
  useLayoutEffect(() => {
    const input = amountInputRef.current;
    if (pendingAmountCaret.current === null || !input) return;
    input.setSelectionRange(pendingAmountCaret.current, pendingAmountCaret.current);
    pendingAmountCaret.current = null;
  });

  // A native <input type="date"> displays dates in the OS locale (e.g.
  // dd/mm/yyyy), which a page can't override. So the visible field is a
  // text input that always shows YYYY-MM-DD, and this button opens a hidden
  // native date input purely for its calendar popup.
  function openCalendar() {
    try {
      datePickerRef.current?.showPicker();
    } catch {
      // Browser without showPicker(): typing the date still works.
    }
  }

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
              {/* Text rather than type="number": number inputs don't expose
                  the cursor position, which the live ".00" mask needs.
                  inputMode="decimal" still brings up a numeric keypad. */}
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
