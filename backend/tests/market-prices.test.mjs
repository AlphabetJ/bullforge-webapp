import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const portfolioSource = await readFile(
  new URL('../src/lib/portfolio.js', import.meta.url),
  'utf8',
);
const portfolioUrl = `data:text/javascript;base64,${Buffer.from(portfolioSource).toString('base64')}`;
const source = await readFile(
  new URL('../src/lib/market-prices.js', import.meta.url),
  'utf8',
);
let moduleId = 0;
async function freshPrices() {
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${moduleId++}`
  );
}
const quote = (price) => ({
  ok: true,
  json: async () => ({
    chart: { result: [{ meta: { regularMarketPrice: price } }] },
  }),
});

test('simultaneous requests share a fetch; fresh cache is reused and expires after 60 seconds', async (t) => {
  const { fetchYahooPrice } = await freshPrices();
  let now = 1_000;
  let calls = 0;
  let release;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.match(url, /\/AAPL\?/);
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    if (calls === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return quote(calls === 1 ? 150 : 160);
  });
  const first = fetchYahooPrice(' aapl ');
  const second = fetchYahooPrice('AAPL');
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await Promise.all([first, second]), [150, 150]);
  now += 59_999;
  assert.equal(await fetchYahooPrice('AAPL'), 150);
  assert.equal(calls, 1);
  now++;
  assert.equal(await fetchYahooPrice('AAPL'), 160);
  assert.equal(calls, 2);
});

test('HTTP errors and invalid prices are not cached, and requests can recover', async (t) => {
  const { fetchYahooPrice } = await freshPrices();
  t.mock.method(console, 'warn', () => {});
  const responses = [
    { ok: false, status: 429 },
    quote(NaN),
    quote(0),
    quote(200),
  ];
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    responses.shift(),
  );
  for (let i = 0; i < 3; i++) assert.equal(await fetchYahooPrice('MSFT'), null);
  assert.equal(await fetchYahooPrice('MSFT'), 200);
  assert.equal(fetchMock.mock.callCount(), 4);
});

test('timeout covers response body, returns fallback signal and releases pending request', async (t) => {
  const { fetchYahooPrice } = await freshPrices();
  t.mock.method(console, 'error', () => {});
  const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, 'timeout', (ms) => {
    assert.equal(ms, 5_000);
    return originalTimeout(10);
  });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    if (++calls > 1) return quote(100);
    return {
      ok: true,
      json: () =>
        new Promise((resolve, reject) => {
          // Keep the test alive while waiting for AbortSignal's unref'ed timer.
          const keeper = setTimeout(resolve, 1_000);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(keeper);
              reject(signal.reason);
            },
            { once: true },
          );
        }),
    };
  });
  assert.equal(await fetchYahooPrice('NVDA'), null);
  assert.equal(await fetchYahooPrice('NVDA'), 100);
  assert.equal(calls, 2);
});

test('cache remains bounded when many symbols are requested', async (t) => {
  const { fetchYahooPrice } = await freshPrices();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => quote(10));
  for (let i = 0; i <= 500; i++) await fetchYahooPrice(`STOCK${i}`);
  assert.equal(await fetchYahooPrice('STOCK500'), 10);
  assert.equal(fetchMock.mock.callCount(), 501);
  await fetchYahooPrice('STOCK0');
  assert.equal(fetchMock.mock.callCount(), 502);
});

test('portfolio recalculates transactions while reusing cached market prices', async (t) => {
  const pricesUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#route-test`;
  const transactions = [
    {
      id: '1',
      symbol: 'NVDA',
      type: 'BUY',
      shares: 9,
      price: 100,
      fees: 0,
      date: '2025-11-07',
    },
    {
      id: '2',
      symbol: 'NVDA',
      type: 'SELL',
      shares: 2,
      price: 120,
      fees: 1,
      date: '2025-11-08',
    },
  ];
  // Load the real route with in-memory data only; never import the SQLite module.
  globalThis.__priceTestTransactions = transactions;
  t.after(() => {
    delete globalThis.__priceTestTransactions;
  });
  const routeSource = (
    await readFile(
      new URL('../src/app/api/portfolio/route.js', import.meta.url),
      'utf8',
    )
  )
    .replace("from '@/lib/portfolio'", `from '${portfolioUrl}'`)
    .replace(
      "import { NextResponse } from 'next/server';",
      'const NextResponse = { json: Response.json };',
    )
    .replace(
      "import { allQuery } from '@/lib/db';",
      'const allQuery = async () => globalThis.__priceTestTransactions;',
    )
    .replace(
      "import { fetchYahooPrice } from '@/lib/market-prices';",
      `import { fetchYahooPrice } from '${pricesUrl}';`,
    );
  const { GET } = await import(
    `data:text/javascript;base64,${Buffer.from(routeSource).toString('base64')}`
  );
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => quote(150));
  const first = await (await GET()).json();
  assert.equal(first.holdings[0].shares, 7);
  assert.equal(first.summary.totalCapitalInvested, 700);
  assert.equal(first.summary.totalCurrentValue, 1050);
  assert.equal(first.summary.totalRealizedPL, 39);
  assert.equal(first.profitHistory.length, 1);
  transactions.push({
    id: '3',
    symbol: 'NVDA',
    type: 'BUY',
    shares: 1,
    price: 100,
    fees: 0,
    date: '2025-11-09',
  });
  const second = await (await GET()).json();
  assert.equal(second.holdings[0].shares, 8);
  assert.equal(second.summary.totalCapitalInvested, 800);
  assert.equal(second.summary.totalCurrentValue, 1200);
  assert.equal(second.summary.totalRealizedPL, 39);
  assert.equal(second.profitHistory.length, 1);
  assert.equal(fetchMock.mock.callCount(), 1);
});
