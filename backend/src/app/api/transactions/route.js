import { NextResponse } from 'next/server';
import { allQuery, runQuery } from '@/lib/db';
import { calculateLedger } from '@/lib/portfolio';
import { transactionCashDelta } from '@/lib/cash-ledger';
import { randomUUID } from 'node:crypto';

// GET /api/transactions - Retrieve all transactions
export async function GET() {
  try {
    const transactions = await allQuery(
      'SELECT * FROM transactions ORDER BY date DESC, id DESC',
    );
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions.' },
      { status: 500 },
    );
  }
}

// POST /api/transactions - Create a new transaction
export async function POST(request) {
  try {
    const body = await request.json();
    const { symbol, type, shares, price, fees, date, source = 'TRADE' } = body;

    if (
      !['TRADE', 'DIVIDEND_REINVESTMENT'].includes(source) ||
      (source === 'DIVIDEND_REINVESTMENT' && type !== 'BUY')
    ) {
      return NextResponse.json(
        { error: 'Dividend reinvestment must be a BUY transaction.' },
        { status: 400 },
      );
    }

    // Validate request inputs
    if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
      return NextResponse.json(
        { error: 'Valid stock symbol is required.' },
        { status: 400 },
      );
    }
    if (type !== 'BUY' && type !== 'SELL') {
      return NextResponse.json(
        { error: 'Type must be BUY or SELL.' },
        { status: 400 },
      );
    }
    const numShares = parseFloat(shares);
    if (!Number.isFinite(numShares) || numShares <= 0) {
      return NextResponse.json(
        { error: 'Shares must be a positive number.' },
        { status: 400 },
      );
    }
    const numPrice = parseFloat(price);
    if (!Number.isFinite(numPrice) || numPrice <= 0) {
      return NextResponse.json(
        { error: 'Price must be a positive number.' },
        { status: 400 },
      );
    }
    const numFees = parseFloat(fees || 0);
    if (!Number.isFinite(numFees) || numFees < 0) {
      return NextResponse.json(
        { error: 'Fees must be a non-negative number.' },
        { status: 400 },
      );
    }
    const txDate = date || new Date().toISOString().split('T')[0];

    // If selling, verify the user has enough shares using the synchronized portfolio logic
    if (type === 'SELL') {
      const symbolUpper = symbol.toUpperCase().trim();

      // Sort chronologically (oldest first) using date and ID for stable sorting
      const sortedTxs = await allQuery(
        'SELECT * FROM transactions ORDER BY date ASC, id ASC',
      );

      const { holdings } = calculateLedger(sortedTxs);
      const currentShares = holdings[symbolUpper]?.shares || 0;

      if (currentShares < numShares) {
        return NextResponse.json(
          {
            error: `Insufficient shares. You only own ${currentShares.toFixed(5)} shares of ${symbolUpper} but tried to sell ${numShares}.`,
          },
          { status: 400 },
        );
      }
    }

    const newTx = {
      id: randomUUID(),
      symbol: symbol.toUpperCase().trim(),
      type,
      shares: numShares,
      price: numPrice,
      fees: numFees,
      date: txDate,
      source,
    };

    await runQuery(
      `INSERT INTO transactions (id, symbol, type, shares, price, fees, date, cash_delta_cents, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTx.id,
        newTx.symbol,
        newTx.type,
        newTx.shares,
        newTx.price,
        newTx.fees,
        newTx.date,
        transactionCashDelta(newTx),
        newTx.source,
      ],
    );

    return NextResponse.json(newTx, { status: 201 });
  } catch (error) {
    console.error('Error adding transaction:', error);
    return NextResponse.json(
      { error: 'Failed to process transaction.' },
      { status: 500 },
    );
  }
}

// DELETE /api/transactions - Clear database (or reset to seeds)
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const reset = searchParams.get('reset') === 'true';

  try {
    if (reset) {
      const seedData = [
        {
          id: '1',
          symbol: 'AAPL',
          type: 'BUY',
          shares: 10,
          price: 150.0,
          fees: 5.0,
          date: '2026-06-01',
        },
        {
          id: '2',
          symbol: 'MSFT',
          type: 'BUY',
          shares: 5,
          price: 300.0,
          fees: 10.0,
          date: '2026-06-02',
        },
        {
          id: '3',
          symbol: 'GOOGL',
          type: 'BUY',
          shares: 8,
          price: 120.0,
          fees: 4.0,
          date: '2026-06-03',
        },
        {
          id: '4',
          symbol: 'AAPL',
          type: 'SELL',
          shares: 3,
          price: 165.0,
          fees: 2.5,
          date: '2026-06-15',
        },
        {
          id: '5',
          symbol: 'AAPL',
          type: 'BUY',
          shares: 5,
          price: 160.0,
          fees: 5.0,
          date: '2026-07-01',
        },
      ];

      await runQuery('DELETE FROM transactions');
      for (const tx of seedData) {
        await runQuery(
          `INSERT INTO transactions (id, symbol, type, shares, price, fees, date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tx.id, tx.symbol, tx.type, tx.shares, tx.price, tx.fees, tx.date],
        );
      }
      return NextResponse.json({
        message: 'Database reset to seed data.',
        data: seedData,
      });
    } else {
      await runQuery('DELETE FROM transactions');
      return NextResponse.json({ message: 'Database cleared.', data: [] });
    }
  } catch (error) {
    console.error('Error clearing/resetting database:', error);
    return NextResponse.json(
      { error: 'Failed to clear/reset database.' },
      { status: 500 },
    );
  }
}
