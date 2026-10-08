<script setup>
import { computed } from 'vue';
import AssetIdentity from './AssetIdentity.vue';
import { currency, shares, dateLabel, monthLabel } from '../utils/format';
const props = defineProps({ transactions: { type: Array, required: true } });
const filters = defineModel('filters', { type: Object, required: true });
const months = computed(() =>
  [...new Set(props.transactions.map((tx) => tx.date.slice(0, 7)))]
    .sort()
    .reverse(),
);
const filteredTransactions = computed(() =>
  props.transactions.filter(
    (tx) =>
      (!filters.value.search.trim() ||
        tx.symbol.includes(filters.value.search.trim().toUpperCase())) &&
      (filters.value.action === 'All' || tx.type === filters.value.action) &&
      (filters.value.month === 'All' ||
        tx.date.startsWith(filters.value.month)),
  ),
);
const isDrip = (tx) =>
  tx.source === 'DIVIDEND_REINVESTMENT' ||
  (!tx.source &&
    tx.symbol === 'JEPQ' &&
    tx.type === 'BUY' &&
    tx.fees === 0 &&
    tx.shares < 1 &&
    String(tx.id).startsWith('csv_'));
</script>
<template>
  <div class="card activity-card">
    <div class="panel-heading">
      <div>
        <h2>Activity</h2>
        <p class="muted">
          {{ filteredTransactions.length }} of
          {{ transactions.length }} transactions
        </p>
      </div>
    </div>
    <div class="transaction-filters">
      <input
        v-model="filters.search"
        class="form-control"
        placeholder="Search asset…"
        aria-label="Search transactions by asset"
      /><select
        v-model="filters.action"
        class="compact-select"
        aria-label="Transaction action"
      >
        <option value="All">All actions</option>
        <option value="BUY">Buy</option>
        <option value="SELL">Sell</option></select
      ><select
        v-model="filters.month"
        class="compact-select"
        aria-label="Transaction month"
      >
        <option value="All">All time</option>
        <option v-for="key in months" :key="key" :value="key">
          {{ monthLabel(key) }}
        </option>
      </select>
    </div>
    <div v-if="!filteredTransactions.length" class="empty-state">
      No transactions match your filters.
    </div>
    <div v-else class="table-container ledger-table">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Asset</th>
            <th>Activity</th>
            <th class="text-right">Shares</th>
            <th class="text-right">Price</th>
            <th class="text-right">Fees</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tx in filteredTransactions" :key="tx.id">
            <td>{{ dateLabel(tx.date) }}</td>
            <td><AssetIdentity :symbol="tx.symbol" /></td>
            <td>
              <span
                class="badge"
                :class="
                  isDrip(tx)
                    ? 'badge-income'
                    : tx.type === 'BUY'
                      ? 'badge-success'
                      : 'badge-danger'
                "
                >{{ isDrip(tx) ? 'DRIP' : tx.type }}</span
              ><small v-if="isDrip(tx)" class="table-subline">{{
                tx.source ? 'Recorded dividend' : 'Estimated dividend'
              }}</small>
            </td>
            <td class="text-right">{{ shares(tx.shares) }}</td>
            <td class="text-right">{{ currency(tx.price) }}</td>
            <td class="text-right">{{ currency(tx.fees) }}</td>
            <td class="text-right font-semibold">
              {{
                currency(
                  tx.shares * tx.price +
                    (tx.type === 'BUY' ? 1 : -1) * (tx.fees || 0),
                )
              }}<small class="table-subline">{{
                tx.type === 'BUY' ? 'Purchase cost' : 'Net sale proceeds'
              }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<style scoped>
.activity-card {
  padding: 24px;
}
.activity-card .panel-heading {
  margin-bottom: 0.75rem;
}
.ledger-table {
  max-height: 680px;
}
.ledger-table table {
  min-width: 760px;
}
.transaction-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.transaction-filters .form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
}
.transaction-filters .compact-select {
  flex: 1 1 120px;
  min-width: 0;
}
.badge-income {
  color: var(--primary);
  background: var(--primary-glow);
}
</style>
