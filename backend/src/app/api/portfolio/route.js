import { NextResponse } from 'next/server';
import { allQuery } from '@/lib/db';



async function fetchYahooPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      console.warn(`Yahoo Finance API returned status ${res.status} for ${symbol}`);
      return null;
    }
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' ? price : null;
  } catch (error) {
    console.error(`Error fetching price for ${symbol} from Yahoo Finance:`, error);
    return null;
  }
}

export async function GET() {
  try {
    // Fetch all transactions chronologically (oldest first)
    const transactions = await allQuery('SELECT * FROM transactions ORDER BY date ASC, id ASC');
    
    // Filter starting from NVDA BUY 9 shares on 2025-11-07
    const startIndex = transactions.findIndex(tx => 
      tx.symbol.toUpperCase() === 'NVDA' && 
      tx.type === 'BUY' && 
      parseFloat(tx.shares) === 9 && 
      tx.date === '2025-11-07'
    );
    const chronoTxs = startIndex !== -1 ? transactions.slice(startIndex) : transactions;

    // Initialize holdings. JEPQ has initial balance before 2025-11-07
    const holdings = {
      JEPQ: {
        symbol: 'JEPQ',
        shares: 29.77505,
        averageCost: 1660.83 / 29.77505,
        totalCost: 1660.83,
        realizedPL: 0
      }
    };

    // Compile realization events directly during processing of SELL transactions
    const profitHistory = [];
    
    let totalRealizedPL = 0;
    let totalJepqDrip = 0;
    const realizedPLByMonth = {};
    const jepqDripByMonth = {};

    // Process transactions sequentially
    for (const tx of chronoTxs) {
      const symbol = tx.symbol.toUpperCase().trim();
      const type = tx.type;
      const shares = parseFloat(tx.shares);
      const price = parseFloat(tx.price);
      const fees = parseFloat(tx.fees || 0);
      const monthKey = tx.date.substring(0, 7); // YYYY-MM

      // Check if it is JEPQ DRIP (BUY, fees = 0, shares < 1.0)
      const isJepqDrip = (symbol === 'JEPQ' && type === 'BUY' && fees === 0 && shares < 1.0);

      if (isJepqDrip) {
        totalJepqDrip += shares * price;
        jepqDripByMonth[monthKey] = (jepqDripByMonth[monthKey] || 0) + (shares * price);
        if (!holdings[symbol]) {
          holdings[symbol] = {
            symbol,
            shares: 0,
            averageCost: 0,
            totalCost: 0,
            realizedPL: 0
          };
        }
        const stock = holdings[symbol];
        stock.shares += shares;
        stock.totalCost += (shares * price);
        stock.averageCost = stock.shares > 0 ? stock.totalCost / stock.shares : 0;
        continue;
      }

      if (!holdings[symbol]) {
        holdings[symbol] = {
          symbol,
          shares: 0,
          averageCost: 0,
          totalCost: 0,
          realizedPL: 0
        };
      }

      const stock = holdings[symbol];

      if (type === 'BUY') {
        const newShares = stock.shares + shares;
        const newTotalCost = (stock.shares * stock.averageCost) + (shares * price) + fees;
        
        stock.shares = newShares;
        stock.averageCost = newShares > 0 ? newTotalCost / newShares : 0;
        stock.totalCost = newTotalCost;
      } else if (type === 'SELL') {
        const proceeds = (shares * price) - fees;
        const costBasisOfSoldShares = shares * stock.averageCost;

        const gainOrLoss = proceeds - costBasisOfSoldShares;
        stock.realizedPL += gainOrLoss;
        totalRealizedPL += gainOrLoss;
        realizedPLByMonth[monthKey] = (realizedPLByMonth[monthKey] || 0) + gainOrLoss;

        const realizedPLPercent = costBasisOfSoldShares > 0 
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
          lastTransactionDate: tx.date
        });

        const newShares = Math.max(0, stock.shares - shares);
        stock.shares = newShares;
        stock.totalCost = newShares * stock.averageCost;
        
        if (newShares === 0) {
          stock.averageCost = 0;
        }
      }
    }

    // Identify active symbols
    const activeSymbols = Object.keys(holdings).filter(symbol => holdings[symbol].shares > 0);

    // Fetch live prices from Yahoo Finance in parallel
    const pricePromises = activeSymbols.map(async (symbol) => {
      const price = await fetchYahooPrice(symbol);
      return { symbol, price };
    });
    const priceResults = await Promise.all(pricePromises);
    const livePrices = {};
    for (const res of priceResults) {
      if (res.price !== null) {
        livePrices[res.symbol] = res.price;
      }
    }

    // Now format the active holdings and calculate current value, weights, and unrealized gains
    const activeHoldings = [];
    let totalCapitalInvested = 0;
    let totalCurrentValue = 0;

    for (const symbol in holdings) {
      const stock = holdings[symbol];
      
      if (stock.shares > 0) {
        // Get Yahoo price or fallback to average cost if API fails
        const currentPrice = livePrices[symbol] !== undefined 
          ? livePrices[symbol] 
          : parseFloat(stock.averageCost.toFixed(2));
        const currentValue = stock.shares * currentPrice;
        const costBasis = stock.shares * stock.averageCost;
        const unrealizedPL = currentValue - costBasis;
        const unrealizedPLPercent = costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;

        totalCapitalInvested += costBasis;
        totalCurrentValue += currentValue;

        activeHoldings.push({
          symbol,
          shares: stock.shares,
          averageCost: parseFloat(stock.averageCost.toFixed(2)),
          costBasis: parseFloat(costBasis.toFixed(2)),
          currentPrice: parseFloat(currentPrice.toFixed(2)),
          currentValue: parseFloat(currentValue.toFixed(2)),
          unrealizedPL: parseFloat(unrealizedPL.toFixed(2)),
          unrealizedPLPercent: parseFloat(unrealizedPLPercent.toFixed(2)),
          realizedPL: parseFloat(stock.realizedPL.toFixed(2))
        });
      }
    }

    // Calculate allocation weight for each active asset (based on capital invested)
    activeHoldings.forEach(asset => {
      asset.weight = totalCapitalInvested > 0 
        ? parseFloat(((asset.costBasis / totalCapitalInvested) * 100).toFixed(2)) 
        : 0;
    });

    // Sort active holdings by weight descending
    activeHoldings.sort((a, b) => b.weight - a.weight);

    // Deduct JEPQ DRIP from active trading realized PL
    const netRealizedPL = totalRealizedPL - totalJepqDrip;

    // Calculate monthly realized PL breakdown
    const monthlyPLBreakdown = {
      All: parseFloat(netRealizedPL.toFixed(2))
    };

    const allMonths = Array.from(new Set([
      ...Object.keys(realizedPLByMonth),
      ...Object.keys(jepqDripByMonth)
    ])).sort();

    allMonths.forEach(mKey => {
      const rPL = realizedPLByMonth[mKey] || 0;
      const drip = jepqDripByMonth[mKey] || 0;
      monthlyPLBreakdown[mKey] = parseFloat((rPL - drip).toFixed(2));
    });

    // Sort profitHistory by lastTransactionDate descending
    profitHistory.sort((a, b) => new Date(b.lastTransactionDate) - new Date(a.lastTransactionDate));

    return NextResponse.json({
      holdings: activeHoldings,
      profitHistory,
      summary: {
        totalCapitalInvested: parseFloat(totalCapitalInvested.toFixed(2)),
        totalCurrentValue: parseFloat(totalCurrentValue.toFixed(2)),
        totalUnrealizedPL: parseFloat((totalCurrentValue - totalCapitalInvested).toFixed(2)),
        totalUnrealizedPLPercent: totalCapitalInvested > 0 ? parseFloat(((totalCurrentValue - totalCapitalInvested) / totalCapitalInvested * 100).toFixed(2)) : 0,
        totalRealizedPL: parseFloat(netRealizedPL.toFixed(2)),
        netProfitLoss: parseFloat((netRealizedPL + totalCurrentValue - totalCapitalInvested).toFixed(2)),
        monthlyRealizedPL: monthlyPLBreakdown
      },
      marketPrices: livePrices
    });
  } catch (error) {
    console.error('Error computing portfolio:', error);
    return NextResponse.json({ error: 'Failed to compute portfolio data.' }, { status: 500 });
  }
}
