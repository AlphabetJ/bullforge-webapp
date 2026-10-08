export function trackedTransactions(transactions) {
  // Preserve the existing legacy import boundary. Earlier rows remain in the activity ledger.
  const startIndex = transactions.findIndex(
    (tx) =>
      tx.symbol.toUpperCase() === 'NVDA' &&
      tx.type === 'BUY' &&
      parseFloat(tx.shares) === 9 &&
      tx.date === '2025-11-07',
  );
  return startIndex !== -1 ? transactions.slice(startIndex) : transactions;
}

export function calculateLedger(transactions) {
  const chronoTxs = trackedTransactions(transactions);
  // Initialize holdings.
  const holdings = {};

  // Compile realization events directly during processing of SELL transactions
  const profitHistory = [];

  let totalRealizedPL = 0;
  let totalDividendIncome = 0;
  const dividendHistory = [];
  const realizedPLByMonth = {};
  const dividendIncomeByMonth = {};

  // Process transactions sequentially
  for (const tx of chronoTxs) {
    const symbol = tx.symbol.toUpperCase().trim();
    const type = tx.type;
    const shares = parseFloat(tx.shares);
    const price = parseFloat(tx.price);
    const fees = parseFloat(tx.fees || 0);
    const monthKey = tx.date.substring(0, 7); // YYYY-MM

    // Legacy imports lack income metadata. Keep the existing JEPQ rule visible as an estimate.
    // Explicit TRADE entries, including fractional purchases, never become dividends.
    const inferredDividend =
      !tx.source &&
      String(tx.id).startsWith('csv_') &&
      symbol === 'JEPQ' &&
      type === 'BUY' &&
      fees === 0 &&
      shares < 1;
    const isDividendReinvestment =
      type === 'BUY' &&
      (tx.source === 'DIVIDEND_REINVESTMENT' || inferredDividend);
    if (isDividendReinvestment) {
      const amount = Number((shares * price + fees).toFixed(2));
      totalDividendIncome += amount;
      dividendIncomeByMonth[monthKey] =
        (dividendIncomeByMonth[monthKey] || 0) + amount;
      dividendHistory.push({
        id: tx.id,
        symbol,
        date: tx.date,
        amount: Number(amount.toFixed(2)),
        inferred: inferredDividend,
        shares,
        price,
      });
    }

    if (!holdings[symbol]) {
      holdings[symbol] = {
        symbol,
        shares: 0,
        averageCost: 0,
        realizedPL: 0,
      };
    }

    const stock = holdings[symbol];

    if (type === 'BUY') {
      const newShares = stock.shares + shares;
      const newTotalCost =
        stock.shares * stock.averageCost + shares * price + fees;

      stock.shares = newShares;
      stock.averageCost = newShares > 0 ? newTotalCost / newShares : 0;
    } else if (type === 'SELL') {
      const proceeds = shares * price - fees;
      const costBasisOfSoldShares = shares * stock.averageCost;

      // Round each realized event once, so cards, monthly totals and the ledger reconcile.
      const gainOrLoss = Number((proceeds - costBasisOfSoldShares).toFixed(2));
      stock.realizedPL += gainOrLoss;
      totalRealizedPL += gainOrLoss;
      realizedPLByMonth[monthKey] =
        (realizedPLByMonth[monthKey] || 0) + gainOrLoss;

      const realizedPLPercent =
        costBasisOfSoldShares > 0
          ? (gainOrLoss / costBasisOfSoldShares) * 100
          : 0;

      // Push this sell transaction as an individual realization event
      profitHistory.push({
        id: tx.id,
        symbol,
        sharesSold: shares,
        avgBuyPrice: parseFloat(stock.averageCost.toFixed(2)),
        avgSellPrice: price,
        totalInvested: parseFloat(costBasisOfSoldShares.toFixed(2)),
        totalProceeds: parseFloat(proceeds.toFixed(2)),
        realizedPL: parseFloat(gainOrLoss.toFixed(2)),
        realizedPLPercent: parseFloat(realizedPLPercent.toFixed(2)),
        totalFees: fees,
        lastTransactionDate: tx.date,
      });

      const newShares = Math.max(0, stock.shares - shares);
      stock.shares = newShares;

      if (newShares === 0) {
        stock.averageCost = 0;
      }
    }
  }

  return {
    holdings,
    profitHistory,
    totalRealizedPL,
    totalDividendIncome,
    dividendHistory,
    realizedPLByMonth,
    dividendIncomeByMonth,
    periodStart: chronoTxs[0]?.date || null,
  };
}

export function valuePortfolio(ledger, livePrices = {}) {
  const {
    holdings,
    profitHistory,
    totalRealizedPL,
    totalDividendIncome,
    dividendHistory,
    realizedPLByMonth,
    dividendIncomeByMonth,
    periodStart,
  } = ledger;
  // Now format the active holdings and calculate current value, weights, and unrealized gains
  const activeHoldings = [];
  let totalCapitalInvested = 0;
  let totalCurrentValue = 0;

  for (const symbol in holdings) {
    const stock = holdings[symbol];

    if (stock.shares > 0) {
      // Get Yahoo price or fallback to average cost if API fails
      const currentPrice =
        livePrices[symbol] !== undefined
          ? livePrices[symbol]
          : parseFloat(stock.averageCost.toFixed(2));
      const currentValue = stock.shares * currentPrice;
      const costBasis = stock.shares * stock.averageCost;
      const unrealizedPL = currentValue - costBasis;
      const unrealizedPLPercent =
        costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;

      totalCapitalInvested += costBasis;
      totalCurrentValue += currentValue;

      activeHoldings.push({
        symbol,
        shares: stock.shares,
        averageCost: parseFloat(stock.averageCost.toFixed(2)),
        costBasis: parseFloat(costBasis.toFixed(2)),
        currentPrice: parseFloat(currentPrice.toFixed(2)),
        currentValue: parseFloat(currentValue.toFixed(2)),
        priceSource:
          livePrices[symbol] !== undefined ? 'market' : 'cost-fallback',
        unrealizedPL: parseFloat(unrealizedPL.toFixed(2)),
        unrealizedPLPercent: parseFloat(unrealizedPLPercent.toFixed(2)),
        realizedPL: parseFloat(stock.realizedPL.toFixed(2)),
      });
    }
  }

  // Market weights describe the current portfolio; retain cost weights separately.
  activeHoldings.forEach((asset) => {
    asset.weight =
      totalCurrentValue > 0
        ? Number(((asset.currentValue / totalCurrentValue) * 100).toFixed(2))
        : 0;
    asset.costWeight =
      totalCapitalInvested > 0
        ? Number(((asset.costBasis / totalCapitalInvested) * 100).toFixed(2))
        : 0;
  });
  activeHoldings.sort((a, b) => b.weight - a.weight);

  // Reinvestment creates cost basis, not a trading loss. A later sale realizes
  // only the change above/below that basis, avoiding double-counting the dividend.
  const monthlyPLBreakdown = { All: Number(totalRealizedPL.toFixed(2)) };
  const monthlyDividendIncome = { All: Number(totalDividendIncome.toFixed(2)) };
  const allMonths = Array.from(
    new Set([
      ...Object.keys(realizedPLByMonth),
      ...Object.keys(dividendIncomeByMonth),
    ]),
  ).sort();
  for (const month of allMonths) {
    monthlyPLBreakdown[month] = Number(
      (realizedPLByMonth[month] || 0).toFixed(2),
    );
    monthlyDividendIncome[month] = Number(
      (dividendIncomeByMonth[month] || 0).toFixed(2),
    );
  }

  // Sort profitHistory by lastTransactionDate descending
  profitHistory.sort(
    (a, b) => new Date(b.lastTransactionDate) - new Date(a.lastTransactionDate),
  );

  return {
    holdings: activeHoldings,
    profitHistory,
    dividendHistory,
    summary: {
      totalCapitalInvested: parseFloat(totalCapitalInvested.toFixed(2)),
      totalCurrentValue: parseFloat(totalCurrentValue.toFixed(2)),
      totalUnrealizedPL: parseFloat(
        (totalCurrentValue - totalCapitalInvested).toFixed(2),
      ),
      totalUnrealizedPLPercent:
        totalCapitalInvested > 0
          ? parseFloat(
              (
                ((totalCurrentValue - totalCapitalInvested) /
                  totalCapitalInvested) *
                100
              ).toFixed(2),
            )
          : 0,
      totalRealizedPL: parseFloat(totalRealizedPL.toFixed(2)),
      totalDividendIncome: Number(totalDividendIncome.toFixed(2)),
      totalInvestmentIncome: Number(
        (totalRealizedPL + totalDividendIncome).toFixed(2),
      ),
      dividendIncomeIsEstimated: dividendHistory.some(
        (event) => event.inferred,
      ),
      monthlyDividendIncome,
      periodStart: periodStart,
      valuationIsEstimated: activeHoldings.some(
        (asset) => asset.priceSource === 'cost-fallback',
      ),
      calculatedAt: new Date().toISOString(),
      netProfitLoss: parseFloat(
        (
          totalRealizedPL +
          totalDividendIncome +
          totalCurrentValue -
          totalCapitalInvested
        ).toFixed(2),
      ),
      monthlyRealizedPL: monthlyPLBreakdown,
    },
    marketPrices: livePrices,
  };
}
