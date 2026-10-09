import test from 'node:test';
import assert from 'node:assert/strict';
import { unrealizedView } from '../../frontend/src/utils/unrealized.js';
const holdings = [
  { unrealizedPL: 100, costBasis: 1000 },
  { unrealizedPL: -40, costBasis: 200 },
  { unrealizedPL: 0, costBasis: 100 },
];
const summary = {
  totalUnrealizedPL: 60,
  totalUnrealizedPLPercent: (60 / 1300) * 100,
};
test('profit and loss views select holdings and use their corresponding cost bases', () => {
  assert.deepEqual(unrealizedView(holdings, summary, 'profit'), {
    amount: 100,
    percent: 10,
    count: 1,
  });
  assert.deepEqual(unrealizedView(holdings, summary, 'loss'), {
    amount: -40,
    percent: -20,
    count: 1,
  });
  assert.deepEqual(unrealizedView(holdings, summary), {
    amount: 60,
    percent: summary.totalUnrealizedPLPercent,
    count: 3,
  });
});
test('empty profit or loss groups give zero without NaN', () => {
  assert.deepEqual(unrealizedView([], summary, 'loss'), {
    amount: 0,
    percent: 0,
    count: 0,
  });
  assert.equal(
    unrealizedView([{ unrealizedPL: 0, costBasis: 100 }], summary, 'profit')
      .count,
    0,
  );
});
