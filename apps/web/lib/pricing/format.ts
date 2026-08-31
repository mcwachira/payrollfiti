/** Formats a tier price for display, e.g. formatPrice(2500, 'KES') -> "KES 2,500". Null price -> "Custom". */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Custom';
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
