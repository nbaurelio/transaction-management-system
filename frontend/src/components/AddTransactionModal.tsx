import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import type { NewTransactionInput } from "../types/transaction";
import { formatCurrency } from "../utils/currency";
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

/** "1234567" -> "1,234,567". Only ever applied to the whole-number part. */
const groupThousands = (wholeDigits: string) => wholeDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** The display value without its thousands separators, ready for Number(). */
const parseAmount = (value: string) => Number(value.replace(/,/g, ""));

/** Index in `grouped` just after its `count`-th digit (commas skipped over). */
function indexAfterDigits(grouped: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < grouped.length; i++) {
    if (/\d/.test(grouped[i]) && ++seen === count) return i + 1;
  }
  return grouped.length;
}

type Deletion = "backward" | "forward" | null;

/**
 * Money mask for the Amount field: once any digit is typed the value always
 * reads as `<whole>.<cents>` with the whole part comma-grouped
 * ("1" -> "1.00", "2131" -> "2,131.00"), and the returned caret keeps typing
 * where the user expects it:
 *   - digits typed in the whole part stay before the point ("12|.00")
 *   - typing "." jumps into the cents
 *   - digits typed in the decimals replace the padding zeros ("12.|00" + 5 -> "12.5|0"),
 *     and more than two decimals can be typed ("12.579"); ".00" is only the minimum
 *   - backspacing the point just steps over it; clearing every whole digit
 *     (with zero cents) empties the field so the placeholder shows again
 *   - backspacing/deleting a comma removes the digit beside it instead,
 *     since the comma itself would only be re-inserted
 * `raw`/`caret` are the input's value and cursor right after the keystroke;
 * `previous` is the value before it, and `deletion` says whether the
 * keystroke was Backspace or Delete.
 */
function maskAmount(
  rawInput: string,
  caretInput: number,
  previous: string,
  deletion: Deletion,
): { value: string; caret: number } {
  let raw = rawInput;
  let caret = caretInput;

  // A comma was the only thing removed: delete the digit next to it instead.
  if (
    deletion &&
    previous[caret] === "," &&
    raw === previous.slice(0, caret) + previous.slice(caret + 1)
  ) {
    if (deletion === "backward" && caret > 0) {
      raw = raw.slice(0, caret - 1) + raw.slice(caret);
      caret -= 1;
    } else if (deletion === "forward") {
      raw = raw.slice(0, caret) + raw.slice(caret + 1);
    }
  }

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
  // Decimals are unlimited, but always at least two. Trailing zeros after
  // the cursor are only padding, so a digit typed in the decimals replaces
  // them ("12.|00" + 5 -> "12.5|0", then 7 -> "12.57|", then 9 -> "12.579|")
  // rather than pushing them along ("12.5700").
  if (!caretInWhole) {
    while (cents.length > Math.max(2, digitsBeforeCaret) && cents.endsWith("0")) {
      cents = cents.slice(0, -1);
    }
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

  const groupedWhole = groupThousands(whole);
  const value = `${groupedWhole}.${cents}`;
  if (!caretInWhole) {
    return { value, caret: groupedWhole.length + 1 + Math.min(digitsBeforeCaret, cents.length) };
  }
  // A lone "0" whole part: sit after it, so the next digit replaces it ("0" + 3 -> "3").
  return { value, caret: whole === "0" ? 1 : indexAfterDigits(groupedWhole, digitsBeforeCaret) };
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
  } else if (Number.isNaN(parseAmount(form.amount))) {
    errors.amount = "Amount must be a number.";
  } else if (parseAmount(form.amount) <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  return errors;
}

export default function AddTransactionModal({ onClose, onSubmit }: AddTransactionModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // "edit" = the form; "review" = a read-only summary the user confirms
  // before anything is sent to the server.
  const [step, setStep] = useState<"edit" | "review">("edit");
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
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
  // Escape steps back from the review to the form, or closes from the form
  // (same as Cancel) — never while a submit is in flight.
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

  // Land keyboard focus on the confirm button when the review appears.
  useEffect(() => {
    if (step === "review") confirmButtonRef.current?.focus();
  }, [step]);

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
                {/* Text rather than type="number": number inputs don't expose
                    the cursor position, which the live ".00" mask needs.
                    inputMode="decimal" still brings up a numeric keypad. */}
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => {
                    const { inputType } = event.nativeEvent as InputEvent;
                    const deletion =
                      inputType === "deleteContentBackward"
                        ? "backward"
                        : inputType === "deleteContentForward"
                          ? "forward"
                          : null;
                    const { value, caret } = maskAmount(
                      event.target.value,
                      event.target.selectionStart ?? event.target.value.length,
                      form.amount,
                      deletion,
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
