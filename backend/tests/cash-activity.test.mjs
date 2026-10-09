import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sortCashActivity,
  summarizeCashActivity,
} from '../../frontend/src/utils/cashActivity.js';
const entries = [
  {
    id: '1',
    date: '2024-01-11',
    type: 'DEPOSIT',
    currency: 'THB',
    amount: 200,
  },
  {
    id: '2',
    date: '2024-01-11',
    time: '09:30:00',
    type: 'FX',
    fromCurrency: 'USD',
    fromAmount: 80,
    toCurrency: 'THB',
    toAmount: 2400,
  },
  {
    id: '3',
    date: '2024-01-11',
    type: 'WITHDRAWAL',
    currency: 'THB',
    amount: 150,
  },
  {
    id: '4',
    date: '2023-12-10',
    type: 'FX',
    fromCurrency: 'THB',
    fromAmount: 3000,
    toCurrency: 'USD',
    toAmount: 100,
  },
  {
    id: '5',
    date: '2024-01-21',
    type: 'WITHDRAWAL',
    currency: 'THB',
    amount: 350,
  },
];
test('latest dates are first; same-day withdrawal sits above FX and deposit without mutating input', () => {
  assert.deepEqual(
    sortCashActivity(entries).map((e) => e.id),
    ['5', '3', '2', '1', '4'],
  );
  assert.equal(entries[0].id, '1');
});
test('summary keeps FX directions and external flows separate', () => {
  const s = summarizeCashActivity(entries);
  assert.equal(s.WITHDRAWAL.amounts.THB, 500);
  assert.equal(s.DEPOSIT.amounts.THB, 200);
  assert.equal(s.FX.count, 2);
  assert.equal(s.FX.directions.length, 2);
  assert.equal(s.FX.directions[0].toAmount, 2400);
});
test('year/type subsets and empty filters produce matching summaries', () => {
  const s = summarizeCashActivity(
    entries.filter((e) => e.date.startsWith('2024') && e.type === 'FX'),
  );
  assert.equal(s.FX.count, 1);
  assert.equal(s.WITHDRAWAL.count, 0);
  assert.deepEqual(s.WITHDRAWAL.amounts, {});
  assert.equal(summarizeCashActivity([]).FX.count, 0);
});
