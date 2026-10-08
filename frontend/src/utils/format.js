export const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
export const percent = value => `${Number(value) >= 0 ? '+' : ''}${(Number(value) || 0).toFixed(2)}%`;
export const shares = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(Number(value) || 0);
export const dateLabel = value => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB') : '—';
export const monthLabel = value => value === 'All' ? 'All time' : new Date(`${value}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
