// At least two decimals, never rounded ($150.00, $12.579). 20 is Intl's max.
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 20,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}
