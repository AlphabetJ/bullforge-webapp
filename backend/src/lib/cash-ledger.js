// Integer cents per cash movement keep repeated refreshes and small fees exact.
// A dividend reinvestment records income and spends it in the same event,
// so it does not spend the existing cash balance.
export function transactionCashDelta({
  type,
  shares,
  price,
  fees = 0,
  source = 'TRADE',
}) {
  if (source === 'DIVIDEND_REINVESTMENT') return 0;
  const amount =
    type === 'BUY' ? -(shares * price + fees) : shares * price - fees;
  if (!Number.isFinite(amount))
    throw new Error('Invalid transaction cash amount.');
  return Math.sign(amount) * Math.round(Math.abs(amount) * 100);
}

export function cashBalance(baseline, postings) {
  const baselineCents = Math.round(baseline.cashUsd * 100);
  const deltaCents = postings.reduce(
    (sum, row) => sum + (row.cash_delta_cents || 0),
    0,
  );
  return {
    ...baseline,
    baselineCashUsd: baseline.cashUsd,
    cashUsd: (baselineCents + deltaCents) / 100,
    adjustedTransactions: postings.filter((row) => row.cash_delta_cents != null)
      .length,
  };
}
