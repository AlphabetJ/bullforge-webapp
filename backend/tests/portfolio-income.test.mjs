import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/app/api/portfolio/route.js', import.meta.url), 'utf8');
let moduleId = 0;
async function calculate(transactions, prices = {}) {
  const route = source
    .replace("import { NextResponse } from 'next/server';", 'const NextResponse = { json: Response.json };')
    .replace("import { allQuery } from '@/lib/db';", `const allQuery = async () => ${JSON.stringify(transactions)};`)
    .replace("import { fetchYahooPrice } from '@/lib/market-prices';", `const fetchYahooPrice = async symbol => (${JSON.stringify(prices)})[symbol] ?? null;`);
  const { GET } = await import(`data:text/javascript;base64,${Buffer.from(route).toString('base64')}#${moduleId++}`);
  const response = await GET();
  assert.equal(response.status, 200);
  return response.json();
}
const buy = (id, symbol, shares, price, date, source) => ({ id, symbol, shares, price, date, source, type: 'BUY', fees: 0 });
const sell = (id, symbol, shares, price, date, fees = 0) => ({ id, symbol, shares, price, date, fees, type: 'SELL' });

test('reinvested dividends remain separate from gains on sale, including liquidation and later fractional sales', async () => {
  const result = await calculate([
    buy('1', 'JEPQ', 10, 50, '2026-01-01', 'TRADE'),
    buy('csv_2', 'JEPQ', .2, 50, '2026-02-01'),
    sell('3', 'JEPQ', 10.2, 60, '2026-02-02', 2),
    buy('4', 'JEPQ', .1, 60, '2026-03-01', 'DIVIDEND_REINVESTMENT'),
    sell('5', 'JEPQ', .1, 61, '2026-03-02', .04)
  ]);
  assert.equal(result.holdings.length, 0);
  assert.equal(result.summary.totalRealizedPL, 100.06);
  assert.equal(result.summary.totalDividendIncome, 16);
  assert.equal(result.summary.totalInvestmentIncome, 116.06);
  assert.equal(result.summary.netProfitLoss, 116.06);
  assert.equal(result.summary.monthlyRealizedPL['2026-02'], 100);
  assert.equal(result.summary.monthlyRealizedPL['2026-03'], .06);
  assert.equal(result.summary.monthlyDividendIncome['2026-02'], 10);
  assert.equal(result.summary.monthlyDividendIncome['2026-03'], 6);
  assert.equal(result.dividendHistory[0].inferred, true);
  assert.equal(result.dividendHistory[1].inferred, false);
  assert.equal(result.profitHistory[0].totalInvested, 6);
});

test('explicit fractional purchases never become dividends; explicit reinvestments support other assets', async () => {
  const result = await calculate([
    buy('csv_1', 'JEPQ', .5, 50, '2026-01-01', 'TRADE'),
    buy('manual_2', 'JEPQ', .5, 50, '2026-01-02'),
    buy('3', 'AAPL', 2, 100, '2026-01-03', 'DIVIDEND_REINVESTMENT')
  ], {JEPQ:60, AAPL:110});
  assert.equal(result.summary.totalDividendIncome, 200);
  assert.equal(result.dividendHistory.length, 1);
  assert.equal(result.summary.dividendIncomeIsEstimated, false);
  assert.equal(result.holdings.find(asset => asset.symbol === 'JEPQ').costBasis, 50);
});

test('market weights use current values; missing quotes visibly mark the valuation as estimated', async () => {
  const result = await calculate([
    buy('1', 'AAPL', 1, 100, '2026-01-01', 'TRADE'),
    buy('2', 'MSFT', 1, 100, '2026-01-02', 'TRADE')
  ], {AAPL:300});
  assert.equal(result.summary.totalCapitalInvested, 200);
  assert.equal(result.summary.totalCurrentValue, 400);
  assert.equal(result.summary.totalUnrealizedPL, 200);
  assert.equal(result.holdings[0].weight, 75);
  assert.equal(result.holdings[0].costWeight, 50);
  assert.equal(result.holdings[1].priceSource, 'cost-fallback');
  assert.equal(result.summary.valuationIsEstimated, true);
});

test('no activity produces explicit zero totals and no start date', async () => {
  const result = await calculate([]);
  assert.equal(result.summary.totalRealizedPL, 0);
  assert.equal(result.summary.totalDividendIncome, 0);
  assert.equal(result.summary.totalInvestmentIncome, 0);
  assert.equal(result.summary.periodStart, null);
});

test('transaction API persists explicit source and rejects dividend sales without writing data', async () => {
  const transactionSource = await readFile(new URL('../src/app/api/transactions/route.js', import.meta.url), 'utf8');
  const writes = [];
  globalThis.__incomeTestWrites = writes;
  try {
    const route = transactionSource
      .replace("import { NextResponse } from 'next/server';", 'const NextResponse = { json: Response.json };')
      .replace("import { allQuery, runQuery } from '@/lib/db';", 'const allQuery = async () => []; const runQuery = async (...args) => globalThis.__incomeTestWrites.push(args);');
    const { POST } = await import(`data:text/javascript;base64,${Buffer.from(route).toString('base64')}`);
    const request = body => new Request('http://localhost/api/transactions', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const dividend = {...buy('1','JEPQ',.2,50,'2026-01-01','DIVIDEND_REINVESTMENT')};
    const success = await POST(request(dividend));
    assert.equal(success.status, 201);
    assert.equal((await success.json()).source, 'DIVIDEND_REINVESTMENT');
    assert.equal(writes[0][1].at(-1), 'DIVIDEND_REINVESTMENT');
    const failure = await POST(request({...dividend,type:'SELL'}));
    assert.equal(failure.status, 400);
    assert.equal(writes.length, 1);
    const ordinary = await POST(request(buy('2','AAPL',.1,50,'2026-01-02')));
    assert.equal((await ordinary.json()).source,'TRADE');
  } finally { delete globalThis.__incomeTestWrites; }
});

test('summary and monthly totals reconcile to cent-rounded ledger events', async () => {
  const result = await calculate([
    buy('1','AAPL',.003,10,'2026-01-01','TRADE'),
    sell('2','AAPL',.001,14.9,'2026-01-02'),
    sell('3','AAPL',.001,14.9,'2026-01-03'),
    sell('4','AAPL',.001,14.9,'2026-01-04')
  ]);
  const ledgerTotal = result.profitHistory.reduce((sum, event) => sum + event.realizedPL, 0);
  assert.equal(result.summary.totalRealizedPL, ledgerTotal);
  assert.equal(result.summary.monthlyRealizedPL['2026-01'], ledgerTotal);
});
