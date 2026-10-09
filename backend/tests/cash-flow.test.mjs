import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(
  new URL('../src/lib/cash-flow.js', import.meta.url),
  'utf8',
);
const { portfolioGrowth } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const statement = (overrides = {}) => ({
  month: '2026-09',
  end: '2026-09-30',
  openingValueThb: 100000,
  closingValueThb: 150000,
  usdThb: 30,
  rows: { Deposits: { THB: 60000 }, Withdrawals: { THB: -20000 } },
  ...overrides,
});
test('deposits and withdrawals are excluded from value growth; FX conversion is explicit', () => {
  const [p] = portfolioGrowth([statement()]);
  assert.equal(p.valueUsd, 5000);
  assert.equal(p.fundingThb, 40000);
  assert.equal(p.growthThb, 10000);
});
test('funding alone does not count as growth and withdrawals alone do not count as loss', () => {
  assert.equal(
    portfolioGrowth([statement({ closingValueThb: 140000 })])[0].growthThb,
    0,
  );
  assert.equal(
    portfolioGrowth([
      statement({
        closingValueThb: 80000,
        rows: { Deposits: { THB: 0 }, Withdrawals: { THB: -20000 } },
      }),
    ])[0].growthThb,
    0,
  );
});
test('USD external funding is included once and old snapshots must be reimported', () => {
  assert.equal(
    portfolioGrowth([
      statement({
        rows: { Deposits: { USD: 100 }, Withdrawals: { USD: -10 } },
      }),
    ])[0].fundingThb,
    2700,
  );
  assert.throws(() => portfolioGrowth([statement({ usdThb: 0 })]), /Reimport/);
  assert.throws(
    () => portfolioGrowth([statement({ closingValueThb: undefined })]),
    /Reimport/,
  );
});
