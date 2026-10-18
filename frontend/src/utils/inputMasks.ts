// Formatting helpers for the Add Transaction form fields.

const digitsOnly = (text: string) => text.replace(/\D/g, "");

/** Today as YYYY-MM-DD in local time (toISOString() would use UTC). */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Inserts hyphens as YYYY-MM-DD while typing. */
export function formatDateInput(rawValue: string): string {
  const digits = digitsOnly(rawValue).slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** True for a complete YYYY-MM-DD that is a real date (rejects 2025-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** 12 digits max, hyphen every 4 (1234-5678-9012). */
export function formatAccountNumber(rawValue: string): string {
  return digitsOnly(rawValue).slice(0, 12).replace(/(\d{4})(?=\d)/g, "$1-");
}

/** Letters and spaces only. */
export function sanitizeAccountHolderName(rawValue: string): string {
  return rawValue.replace(/[^A-Za-z\s]/g, "");
}

/** Amount display value ("1,234.50") to a number. */
export const parseAmount = (value: string) => Number(value.replace(/,/g, ""));

// Same 13-digit limit as the backend's @Digits(integer = 13).
const MAX_AMOUNT_WHOLE_DIGITS = 13;

const groupThousands = (wholeDigits: string) => wholeDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Index in `grouped` just after its `count`-th digit. */
function indexAfterDigits(grouped: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < grouped.length; i++) {
    if (/\d/.test(grouped[i]) && ++seen === count) return i + 1;
  }
  return grouped.length;
}

export type Deletion = "backward" | "forward" | null;

/** Backspace / Delete / neither, from an input event's inputType. */
export function deletionFrom(inputType: string): Deletion {
  if (inputType === "deleteContentBackward") return "backward";
  if (inputType === "deleteContentForward") return "forward";
  return null;
}

/**
 * Live money mask: "1" -> "1.00", "2131" -> "2,131.00", at least two decimals.
 * Returns the new value and where the cursor should go.
 * `raw`/`caret` are the input right after the keystroke; `previous` is before it.
 */
export function maskAmount(
  raw: string,
  caret: number,
  previous: string,
  deletion: Deletion,
): { value: string; caret: number } {
  let text = raw;
  let cursor = caret;

  // Deleting a comma deletes the digit beside it instead.
  if (deletion && previous[cursor] === "," && text === previous.slice(0, cursor) + previous.slice(cursor + 1)) {
    if (deletion === "backward" && cursor > 0) {
      text = text.slice(0, cursor - 1) + text.slice(cursor);
      cursor -= 1;
    } else if (deletion === "forward") {
      text = text.slice(0, cursor) + text.slice(cursor + 1);
    }
  }

  // Deleting the decimal point just steps over it.
  if (previous.includes(".") && text === previous.replace(".", "")) {
    return { value: previous, caret: previous.indexOf(".") };
  }
  if (text === ".") {
    return { value: "0.00", caret: 2 };
  }

  // Typing "." again jumps into the decimals.
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

  // Nothing left: clear the field.
  if (!whole && !/[1-9]/.test(cents)) {
    return { value: "", caret: 0 };
  }

  // Typed decimals replace the padding zeros ("12.|00" + 5 -> "12.5|0").
  if (!caretInWhole) {
    while (cents.length > Math.max(2, digitsBeforeCaret) && cents.endsWith("0")) {
      cents = cents.slice(0, -1);
    }
  }
  cents = cents.padEnd(2, "0");

  // A digit typed next to a lone "0" replaces it ("0.50" + 3 -> "3.50").
  if (previous.startsWith("0.") && whole.length === 2) {
    const zeroAt = whole.indexOf("0");
    whole = whole.slice(0, zeroAt) + whole.slice(zeroAt + 1);
    if (caretInWhole && zeroAt < digitsBeforeCaret) digitsBeforeCaret -= 1;
  }

  const stripped = whole.replace(/^0+(?=\d)/, "");
  if (caretInWhole) digitsBeforeCaret = Math.max(0, digitsBeforeCaret - (whole.length - stripped.length));
  whole = stripped || "0";
  if (whole.length > MAX_AMOUNT_WHOLE_DIGITS) {
    return { value: previous, caret: Math.max(0, cursor - 1) };
  }

  const groupedWhole = groupThousands(whole);
  const value = `${groupedWhole}.${cents}`;
  if (!caretInWhole) {
    return { value, caret: groupedWhole.length + 1 + Math.min(digitsBeforeCaret, cents.length) };
  }
  // After a lone "0", so the next digit replaces it.
  return { value, caret: whole === "0" ? 1 : indexAfterDigits(groupedWhole, digitsBeforeCaret) };
}
