// At least two decimals ($150.00), but never rounds away extra ones the
// user entered ($12.579 stays $12.579) — 20 is Intl's maximum.
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 20,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
