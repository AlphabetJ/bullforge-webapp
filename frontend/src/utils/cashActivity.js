// Statements omit transfer times. For same-day display, show withdrawals
// above FX above deposits, so reading bottom-up follows funding → FX → withdrawal.
export function sortCashActivity(entries) {
  const order = { WITHDRAWAL: 2, FX: 1, DEPOSIT: 0 };
  return [...entries].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (order[b.type] ?? 0) - (order[a.type] ?? 0) ||
      (b.time || '').localeCompare(a.time || '') ||
      a.id.localeCompare(b.id),
  );
}

export function summarizeCashActivity(entries) {
  const totals = {
    FX: { count: 0, directions: [] },
    DEPOSIT: { count: 0, amounts: {} },
    WITHDRAWAL: { count: 0, amounts: {} },
  };
  for (const entry of entries) {
    const group = totals[entry.type];
    if (!group) continue;
    group.count++;
    if (entry.type === 'FX') {
      let direction = group.directions.find(
        (d) =>
          d.fromCurrency === entry.fromCurrency &&
          d.toCurrency === entry.toCurrency,
      );
      if (!direction) {
        direction = {
          fromCurrency: entry.fromCurrency,
          toCurrency: entry.toCurrency,
          fromAmount: 0,
          toAmount: 0,
        };
        group.directions.push(direction);
      }
      direction.fromAmount += Math.round(entry.fromAmount * 100);
      direction.toAmount += Math.round(entry.toAmount * 100);
    } else {
      group.amounts[entry.currency] =
        (group.amounts[entry.currency] || 0) + Math.round(entry.amount * 100);
    }
  }
  for (const d of totals.FX.directions) {
    d.fromAmount /= 100;
    d.toAmount /= 100;
  }
  for (const type of ['DEPOSIT', 'WITHDRAWAL']) {
    for (const currency of Object.keys(totals[type].amounts))
      totals[type].amounts[currency] /= 100;
  }
  return totals;
}
