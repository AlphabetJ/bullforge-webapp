const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const sharesFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 5,
});
export const currency = (value) => currencyFormatter.format(Number(value) || 0);
export const percent = (value) =>
  `${Number(value) >= 0 ? '+' : ''}${(Number(value) || 0).toFixed(2)}%`;
export const shares = (value) => sharesFormatter.format(Number(value) || 0);
export const dateLabel = (value) =>
  value
    ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB')
    : '—';
export const monthLabel = (value) =>
  value === 'All'
    ? 'All time'
    : new Date(`${value}-01T00:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
export const compactShares = (value) => {
  const number = Number(value) || 0;
  return number > 0 && number < 0.01 ? '< 0.01' : number.toFixed(2);
};
