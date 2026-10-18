import type { Transaction } from "../types/transaction";

/** [start, end) character range of a search match. */
export type Range = [start: number, end: number];

const normalize = (query: string) => query.trim().toLowerCase();
const withoutHyphens = (text: string) => text.replace(/-/g, "");

/** Name contains the query (any case), or account number does (hyphens ignored). */
export function matchesSearch(transaction: Transaction, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  if (transaction.accountHolderName.toLowerCase().includes(q)) return true;
  const qDigits = withoutHyphens(q);
  return qDigits !== "" && withoutHyphens(transaction.accountNumber).includes(qDigits);
}

function findOccurrences(haystack: string, needle: string): Range[] {
  const ranges: Range[] = [];
  if (!needle) return ranges;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    ranges.push([index, index + needle.length]);
    index = haystack.indexOf(needle, index + needle.length);
  }
  return ranges;
}

export function nameMatchRanges(name: string, query: string): Range[] {
  return findOccurrences(name.toLowerCase(), normalize(query));
}

/** Matches on digits only, mapped back so a range can span a hyphen ("1122-3456"). */
export function accountMatchRanges(accountNumber: string, query: string): Range[] {
  const positions: number[] = [];
  let digits = "";
  for (let i = 0; i < accountNumber.length; i++) {
    if (accountNumber[i] !== "-") {
      positions.push(i);
      digits += accountNumber[i];
    }
  }
  return findOccurrences(digits, withoutHyphens(normalize(query))).map(([start, end]) => [
    positions[start],
    positions[end - 1] + 1,
  ]);
}
