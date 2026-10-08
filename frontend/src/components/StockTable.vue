<script setup>
import AssetIdentity from './AssetIdentity.vue';
import { computed, ref } from 'vue';
import { currency, percent, shares } from '../utils/format';
const props = defineProps({ holdings: { type: Array, required: true } });
const sort = ref('currentValue');
const descending = ref(true);
const sorted = computed(() =>
  [...props.holdings].sort((a, b) => {
    const comparison =
      typeof a[sort.value] === 'string'
        ? a[sort.value].localeCompare(b[sort.value])
        : a[sort.value] - b[sort.value];
    return descending.value ? -comparison : comparison;
  }),
);
function changeSort(key) {
  descending.value = sort.value === key ? !descending.value : true;
  sort.value = key;
}
const columns = [
  { key: 'symbol', label: 'Asset' },
  { key: 'currentPrice', label: 'Price' },
  { key: 'averageCost', label: 'Avg cost' },
  { key: 'shares', label: 'Shares' },
  { key: 'currentValue', label: 'Market value' },
  { key: 'unrealizedPL', label: 'Unrealized P/L' },
  { key: 'weight', label: 'Weight' },
];
</script>
<template>
  <div class="card holdings-card">
    <div class="panel-heading">
      <div>
        <h2>Holdings</h2>
        <p class="muted">
          {{ holdings.length }} assets · weight by current market value
        </p>
      </div>
    </div>
    <div v-if="!holdings.length" class="empty-state">
      No holdings yet. Record a purchase in Transactions.
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="{ 'text-right': column.key !== 'symbol' }"
              :aria-sort="
                sort === column.key
                  ? descending
                    ? 'descending'
                    : 'ascending'
                  : 'none'
              "
            >
              <button class="sort-button" @click="changeSort(column.key)">
                {{ column.label }}
                <span v-if="sort === column.key">{{
                  descending ? '↓' : '↑'
                }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="asset in sorted" :key="asset.symbol">
            <td><AssetIdentity :symbol="asset.symbol" /></td>
            <td class="text-right">
              <span
                :class="
                  asset.priceSource === 'cost-fallback'
                    ? 'text-muted'
                    : 'live-price-cell'
                "
                >{{ currency(asset.currentPrice) }}</span
              ><small
                v-if="asset.priceSource === 'cost-fallback'"
                class="table-subline"
                >Cost fallback</small
              >
            </td>
            <td class="text-right">{{ currency(asset.averageCost) }}</td>
            <td class="text-right">{{ shares(asset.shares) }}</td>
            <td class="text-right font-semibold">
              {{ currency(asset.currentValue)
              }}<small class="table-subline"
                >Cost {{ currency(asset.costBasis) }}</small
              >
            </td>
            <td
              class="text-right"
              :class="asset.unrealizedPL >= 0 ? 'pl-positive' : 'pl-negative'"
            >
              {{ currency(asset.unrealizedPL)
              }}<small class="table-subline" style="color: inherit">{{
                percent(asset.unrealizedPLPercent)
              }}</small>
            </td>
            <td class="text-right">{{ asset.weight.toFixed(2) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
