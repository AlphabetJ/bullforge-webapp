export function unrealizedView(holdings, summary, mode = 'net') {
  const selected = holdings.filter((h) =>
    mode === 'profit'
      ? h.unrealizedPL > 0
      : mode === 'loss'
        ? h.unrealizedPL < 0
        : true,
  );
  if (mode === 'net')
    return {
      amount: summary.totalUnrealizedPL || 0,
      percent: summary.totalUnrealizedPLPercent || 0,
      count: selected.length,
    };
  const amount =
    Math.round(
      selected.reduce((sum, h) => sum + Math.round(h.unrealizedPL * 100), 0),
    ) / 100;
  const cost = selected.reduce((sum, h) => sum + h.costBasis, 0);
  return {
    amount,
    percent: cost > 0 ? (amount / cost) * 100 : 0,
    count: selected.length,
  };
}
