import { NextResponse } from 'next/server';
import { allQuery } from '@/lib/db';
import { fetchYahooPrice } from '@/lib/market-prices';
import { calculateLedger, valuePortfolio } from '@/lib/portfolio';

export async function GET() {
  try {
    const transactions = await allQuery(
      'SELECT * FROM transactions ORDER BY date ASC, id ASC',
    );
    const ledger = calculateLedger(transactions);
    const activeSymbols = Object.keys(ledger.holdings).filter(
      (symbol) => ledger.holdings[symbol].shares > 0,
    );
    const quotes = await Promise.all(
      activeSymbols.map(async (symbol) => [
        symbol,
        await fetchYahooPrice(symbol),
      ]),
    );
    const livePrices = Object.fromEntries(
      quotes.filter(([, price]) => price !== null),
    );
    return NextResponse.json(valuePortfolio(ledger, livePrices));
  } catch (error) {
    console.error('Error computing portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to compute portfolio data.' },
      { status: 500 },
    );
  }
}
