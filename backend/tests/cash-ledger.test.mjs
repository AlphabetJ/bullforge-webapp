import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sqlite3 from 'sqlite3';
const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cashUrl = url(
  await readFile(new URL('../src/lib/cash-ledger.js', import.meta.url), 'utf8'),
);
const { transactionCashDelta, cashBalance } = await import(cashUrl);
const portfolioUrl = url(
  await readFile(new URL('../src/lib/portfolio.js', import.meta.url), 'utf8'),
);
const routeSource = await readFile(
  new URL('../src/app/api/transactions/route.js', import.meta.url),
  'utf8',
);

test('cash movements include fees, skip existing rows, and offset dividend reinvestment', () => {
  assert.equal(
    transactionCashDelta({ type: 'BUY', shares: 2, price: 100, fees: 1 }),
    -20100,
  );
  assert.equal(
    transactionCashDelta({ type: 'SELL', shares: 2, price: 110, fees: 1 }),
    21900,
  );
  assert.equal(
    transactionCashDelta({
      type: 'BUY',
      shares: 0.25,
      price: 50,
      source: 'DIVIDEND_REINVESTMENT',
    }),
    0,
  );
  const postings = [
    { cash_delta_cents: null },
    { cash_delta_cents: -20100 },
    { cash_delta_cents: 21900 },
  ];
  assert.equal(cashBalance({ cashUsd: 1016.83 }, postings).cashUsd, 1034.83);
  assert.equal(cashBalance({ cashUsd: 1016.83 }, postings).cashUsd, 1034.83);
  assert.equal(cashBalance({ cashUsd: 0 }, []).cashUsd, 0);
});

test('real SQLite transaction API changes cash once; rejected or failed trades do not change it', async () => {
  const db = new sqlite3.Database(':memory:');
  const run = (sql, params = []) =>
    new Promise((resolve, reject) =>
      db.run(sql, params, function (err) {
        err ? reject(err) : resolve({ changes: this.changes });
      }),
    );
  const all = (sql, params = []) =>
    new Promise((resolve, reject) =>
      db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))),
    );
  await run(
    'CREATE TABLE transactions (id TEXT PRIMARY KEY, symbol TEXT, type TEXT, shares REAL, price REAL, fees REAL, date TEXT, source TEXT, cash_delta_cents INTEGER)',
  );
  await run(
    "INSERT INTO transactions VALUES ('old','NVDA','BUY',2,100,0,'2026-10-08','TRADE',NULL)",
  );
  globalThis.__cashLedgerTest = { all, run };
  try {
    const source = routeSource
      .replace(
        "import { NextResponse } from 'next/server';",
        'const NextResponse = { json: Response.json };',
      )
      .replace(
        "import { allQuery, runQuery } from '@/lib/db';",
        'const allQuery = (...args) => globalThis.__cashLedgerTest.all(...args); const runQuery = (...args) => globalThis.__cashLedgerTest.run(...args);',
      )
      .replace("from '@/lib/portfolio'", `from '${portfolioUrl}'`)
      .replace("from '@/lib/cash-ledger'", `from '${cashUrl}'`);
    const { POST } = await import(url(source));
    const post = (body) =>
      POST(
        new Request('http://localhost/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
    const cash = async () =>
      cashBalance(
        { cashUsd: 1016.83 },
        await all('SELECT cash_delta_cents FROM transactions'),
      ).cashUsd;
    const trade = {
      symbol: 'NVDA',
      type: 'BUY',
      shares: 1,
      price: 100,
      fees: 1,
      date: '2026-10-01',
    };
    // Backdated entries added now still affect current cash; the existing row does not.
    assert.equal((await post(trade)).status, 201);
    assert.equal(await cash(), 915.83);
    assert.equal(
      (await post({ ...trade, type: 'SELL', price: 150 })).status,
      201,
    );
    assert.equal(await cash(), 1064.83);
    assert.equal(
      (await post({ ...trade, shares: 0.1, source: 'DIVIDEND_REINVESTMENT' }))
        .status,
      201,
    );
    assert.equal(await cash(), 1064.83);
    assert.equal(
      (await post({ ...trade, type: 'SELL', shares: 99 })).status,
      400,
    );
    assert.equal(await cash(), 1064.83);
    globalThis.__cashLedgerTest.run = async () => {
      throw new Error('simulated insert failure');
    };
    const previousError = console.error;
    console.error = () => {};
    try {
      assert.equal((await post(trade)).status, 500);
    } finally {
      console.error = previousError;
    }
    assert.equal(await cash(), 1064.83);
    assert.equal((await all('SELECT * FROM transactions')).length, 4);
  } finally {
    delete globalThis.__cashLedgerTest;
    await new Promise((resolve, reject) =>
      db.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
