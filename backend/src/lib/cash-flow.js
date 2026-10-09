// Historical account values include cash. Adjust changes for external funding,
// rather than mistaking deposits for investment gains. USD figures are estimates
// translated at each statement's closing FX rate.
export function portfolioGrowth(statements) {
  return [...statements]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((s) => {
      if (
        ![s.openingValueThb, s.closingValueThb, s.usdThb].every(
          Number.isFinite,
        ) ||
        s.usdThb <= 0
      )
        throw new Error('Reimport PDFs to include portfolio valuations.');
      const fundingThb =
        (s.rows.Deposits.THB || 0) +
        (s.rows.Withdrawals.THB || 0) +
        ((s.rows.Deposits.USD || 0) + (s.rows.Withdrawals.USD || 0)) * s.usdThb;
      const changeThb = s.closingValueThb - s.openingValueThb;
      return {
        month: s.month,
        date: s.end,
        valueThb: s.closingValueThb,
        valueUsd: s.closingValueThb / s.usdThb,
        fundingThb,
        growthThb: changeThb - fundingThb,
        usdThb: s.usdThb,
      };
    });
}
