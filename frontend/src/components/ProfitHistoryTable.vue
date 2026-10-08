<script setup>
import AssetIdentity from './AssetIdentity.vue';
import { ref, computed } from 'vue';
import {
  currency,
  percent,
  shares,
  dateLabel,
  monthLabel,
} from '../utils/format';
const props = defineProps({
  profitHistory: { type: Array, required: true },
  dividendHistory: { type: Array, default: () => [] },
  summary: { type: Object, required: true },
});
const month = ref('All');
const search = ref('');
const sortBy = ref('lastTransactionDate');
const descending = ref(true);
const months = computed(() =>
  [
    ...new Set([
      ...props.profitHistory.map((event) =>
        event.lastTransactionDate.slice(0, 7),
      ),
      ...props.dividendHistory.map((event) => event.date.slice(0, 7)),
    ]),
  ]
    .sort()
    .reverse(),
);
const matches = (symbol, date) =>
  (!search.value.trim() ||
    symbol.includes(search.value.trim().toUpperCase())) &&
  (month.value === 'All' || date.startsWith(month.value));
const sales = computed(() =>
  props.profitHistory.filter((event) =>
    matches(event.symbol, event.lastTransactionDate),
  ),
);
const dividends = computed(() =>
  props.dividendHistory.filter((event) => matches(event.symbol, event.date)),
);
const realized = computed(() =>
  month.value === 'All' && !search.value.trim()
    ? props.summary.totalRealizedPL
    : sales.value.reduce((sum, event) => sum + event.realizedPL, 0),
);
const dividendIncome = computed(() =>
  month.value === 'All' && !search.value.trim()
    ? props.summary.totalDividendIncome || 0
    : dividends.value.reduce((sum, event) => sum + event.amount, 0),
);
const wins = computed(
  () => sales.value.filter((event) => event.realizedPL > 0).length,
);
const winRate = computed(() =>
  sales.value.length ? (wins.value / sales.value.length) * 100 : 0,
);
const inferred = computed(() =>
  dividends.value.some((event) => event.inferred),
);
const ranked = computed(() => {
  const groups = {};
  for (const event of sales.value)
    groups[event.symbol] = (groups[event.symbol] || 0) + event.realizedPL;
  return Object.entries(groups).sort((a, b) => b[1] - a[1]);
});
const rows = computed(() =>
  [...sales.value].sort((a, b) => {
    const comparison =
      typeof a[sortBy.value] === 'string'
        ? a[sortBy.value].localeCompare(b[sortBy.value])
        : a[sortBy.value] - b[sortBy.value];
    return descending.value ? -comparison : comparison;
  }),
);
function sort(key) {
  descending.value = sortBy.value === key ? !descending.value : true;
  sortBy.value = key;
}
const columns = [
  { key: 'symbol', label: 'Asset' },
  { key: 'sharesSold', label: 'Shares sold' },
  { key: 'avgBuyPrice', label: 'Avg cost' },
  { key: 'avgSellPrice', label: 'Sell price' },
  { key: 'totalInvested', label: 'Cost basis' },
  { key: 'totalProceeds', label: 'Net proceeds' },
  { key: 'totalFees', label: 'Sell fees' },
  { key: 'realizedPL', label: 'Realized P/L' },
  { key: 'lastTransactionDate', label: 'Sale date' },
];
const averageSalePL = computed(() =>
  sales.value.length
    ? sales.value.reduce((total, sale) => total + sale.realizedPL, 0) /
      sales.value.length
    : 0,
);
const mostTraded = computed(() => {
  const counts = new Map();
  for (const sale of sales.value)
    counts.set(sale.symbol, (counts.get(sale.symbol) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
});
</script>
<template>
  <div class="profit-history-container">
    <div class="returns-toolbar">
      <div class="returns-heading">
        <h2>Realized returns</h2>
        <p class="muted">{{ monthLabel(month) }} · {{ sales.length }} sales</p>
      </div>
      <div class="filters-row">
        <div class="filter-field">
          <label for="returns-asset">Asset</label>
          <input
            id="returns-asset"
            v-model="search"
            class="form-control"
            placeholder="Search asset…"
          />
        </div>
        <div class="filter-field">
          <label for="returns-period">Period</label>
          <select id="returns-period" v-model="month" class="form-control">
            <option value="All">All time</option>
            <option v-for="key in months" :key="key" :value="key">
              {{ monthLabel(key) }}
            </option>
          </select>
        </div>
      </div>
    </div>
    <section class="grid-summary metrics-four">
      <div class="card summary-card">
        <span class="summary-label">Realized sale P/L</span
        ><strong
          class="summary-value"
          :class="realized >= 0 ? 'pl-positive' : 'pl-negative'"
          >{{ currency(realized) }}</strong
        ><small class="muted">After recorded fees</small>
      </div>
      <div class="card summary-card">
        <span class="summary-label">{{
          inferred ? 'Estimated reinvested dividends' : 'Reinvested dividends'
        }}</span
        ><strong class="summary-value">{{ currency(dividendIncome) }}</strong>
      </div>
      <div class="card summary-card">
        <span class="summary-label">Recorded realized income</span
        ><strong
          class="summary-value"
          :class="
            realized + dividendIncome >= 0 ? 'pl-positive' : 'pl-negative'
          "
          >{{ currency(realized + dividendIncome) }}</strong
        >
      </div>
      <div class="card summary-card">
        <span class="summary-label">Profitable sales</span
        ><strong class="summary-value">{{
          sales.length ? winRate.toFixed(1) + '%' : '—'
        }}</strong
        ><small class="muted"
          >{{ wins }} profitable / {{ sales.length }} sales</small
        >
      </div>
    </section>
    <section
      v-if="sales.length"
      class="return-facts"
      aria-label="Insights for the selected asset and period"
    >
      <div class="return-fact">
        <span class="fact-label">Highest total P/L by asset</span>
        <strong
          >{{ ranked[0][0] }}
          <span :class="ranked[0][1] >= 0 ? 'pl-positive' : 'pl-negative'">{{
            currency(ranked[0][1])
          }}</span></strong
        >
      </div>
      <div v-if="ranked.length > 1" class="return-fact">
        <span class="fact-label">Lowest total P/L by asset</span>
        <strong
          >{{ ranked.at(-1)[0] }}
          <span
            :class="ranked.at(-1)[1] >= 0 ? 'pl-positive' : 'pl-negative'"
            >{{ currency(ranked.at(-1)[1]) }}</span
          ></strong
        >
      </div>
      <div class="return-fact">
        <span class="fact-label">Average P/L per sale</span>
        <strong :class="averageSalePL >= 0 ? 'pl-positive' : 'pl-negative'">{{
          currency(averageSalePL)
        }}</strong>
      </div>
      <div class="return-fact">
        <span class="fact-label">Most frequently sold asset</span>
        <strong
          >{{ mostTraded[0] }}
          <span class="fact-detail"
            >{{ mostTraded[1] }}
            {{ mostTraded[1] === 1 ? 'sale' : 'sales' }}</span
          ></strong
        >
      </div>
    </section>
    <div class="card">
      <div class="panel-heading">
        <div><h2>Sale history</h2></div>
      </div>
      <div v-if="!rows.length" class="empty-state">
        No sales match this period or asset.
      </div>
      <div v-else class="table-container ledger-table">
        <table>
          <thead>
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                :class="{
                  'text-right': !['symbol', 'lastTransactionDate'].includes(
                    column.key,
                  ),
                }"
                :aria-sort="
                  sortBy === column.key
                    ? descending
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                "
              >
                <button class="sort-button" @click="sort(column.key)">
                  {{ column.label }}
                  <span v-if="sortBy === column.key">{{
                    descending ? '↓' : '↑'
                  }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in rows" :key="event.id">
              <td><AssetIdentity :symbol="event.symbol" /></td>
              <td class="text-right">{{ shares(event.sharesSold) }}</td>
              <td class="text-right">{{ currency(event.avgBuyPrice) }}</td>
              <td class="text-right">{{ currency(event.avgSellPrice) }}</td>
              <td class="text-right">{{ currency(event.totalInvested) }}</td>
              <td class="text-right">{{ currency(event.totalProceeds) }}</td>
              <td class="text-right">{{ currency(event.totalFees) }}</td>
              <td
                class="text-right"
                :class="event.realizedPL >= 0 ? 'pl-positive' : 'pl-negative'"
              >
                {{ currency(event.realizedPL)
                }}<small class="table-subline" style="color: inherit">{{
                  percent(event.realizedPLPercent)
                }}</small>
              </td>
              <td>{{ dateLabel(event.lastTransactionDate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <details class="card dividend-details">
      <summary>
        Dividend reinvestment records · {{ dividends.length }} entries ·
        {{ currency(dividendIncome) }}
      </summary>
      <div v-if="!dividends.length" class="empty-state">
        No recorded reinvestments in this period.
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th class="text-right">Shares</th>
              <th class="text-right">Reinvested amount</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in dividends" :key="event.id">
              <td>{{ dateLabel(event.date) }}</td>
              <td><AssetIdentity :symbol="event.symbol" /></td>
              <td class="text-right">{{ shares(event.shares) }}</td>
              <td class="text-right">{{ currency(event.amount) }}</td>
              <td>
                {{
                  event.inferred
                    ? 'Estimated legacy import'
                    : 'Recorded dividend reinvestment'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <details class="income-explanation">
      <summary>วิธีคำนวณกำไรจากการขาย</summary>
      <p>
        กำไรจากการขาย = เงินขายหลังค่าธรรมเนียม − ต้นทุนเฉลี่ยของหน่วยที่ขาย
        โดยต้นทุนเฉลี่ยรวมค่าธรรมเนียมซื้อ และรวมการขายกองทุนหรือเศษหน่วยด้วย
      </p>
    </details>
  </div>
</template>
<style scoped>
.profit-history-container > .card {
  margin-bottom: 20px;
}
.returns-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  align-items: end;
  gap: 24px;
  padding-bottom: 24px;
}
.returns-heading h2 {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.35px;
}
.returns-heading p {
  font-size: 12px;
  margin: 6px 0 0;
}
.filters-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 12px;
}
.filter-field {
  min-width: 0;
}
.filter-field label {
  display: block;
  font-size: 11px;
  font-weight: 550;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.filter-field .form-control {
  height: 44px;
  min-width: 0;
}
.return-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  border-top: 1px solid var(--panel-border);
  border-bottom: 1px solid var(--panel-border);
  margin: 4px 0 24px;
}
.return-fact {
  padding: 18px 16px;
  min-width: 0;
}
.fact-label {
  display: block;
  color: var(--text-secondary);
  font-size: 11px;
  margin-bottom: 6px;
}
.return-fact strong {
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-wrap: wrap;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.fact-detail {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 400;
}
.income-explanation {
  border-top: 1px solid var(--panel-border);
  padding: 16px 0;
}
.income-explanation summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
}
.income-explanation p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 12px 0 0;
  line-height: 1.8;
  max-width: 850px;
}
.dividend-details summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 550;
}
.dividend-details[open] summary {
  margin-bottom: 16px;
}
@media (max-width: 850px) {
  .returns-toolbar {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .filters-row {
    width: 100%;
  }
}
@media (max-width: 500px) {
  .return-facts {
    grid-template-columns: 1fr 1fr;
  }
  .return-fact {
    padding: 14px 8px;
  }
  .return-fact strong {
    font-size: 13px;
  }
}
@media (max-width: 360px) {
  .filters-row,
  .return-facts {
    grid-template-columns: 1fr;
  }
}
</style>
