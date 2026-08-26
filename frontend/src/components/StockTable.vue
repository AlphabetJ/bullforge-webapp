<script setup>
defineProps({
  holdings: {
    type: Array,
    required: true
  }
});

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(val);
};

const formatPercent = (val) => {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
};

const formatShares = (val) => {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  if (num > 0 && num < 0.01) {
    return '< 0.01';
  }
  return num.toFixed(2);
};
</script>

<template>
  <div class="card fade-in-up">
    <h2 class="section-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="13" x2="15" y2="13"></line><line x1="9" y1="17" x2="15" y2="17"></line></svg>
      Asset Details
    </h2>

    <div v-if="holdings.length === 0" class="empty-state">
      <div class="empty-state-icon">📁</div>
      <div class="empty-state-title">No Assets Recorded</div>
      <p>Enter your stock transactions to generate an overview table.</p>
    </div>

    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th class="text-right live-price-col">Current Price</th>
            <th class="text-right">Avg Cost per Shares</th>
            <th class="text-right">Shares</th>
            <th class="text-right">Total Cost</th>
            <th class="text-right">Unrealized Profit</th>
            <th class="text-right">Unrealized ROI (%)</th>
            <th class="text-right">Weight</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="asset in holdings" :key="asset.symbol">
            <td>
              <span class="stock-symbol-badge">{{ asset.symbol }}</span>
            </td>
            <td class="text-right live-price-cell">{{ formatCurrency(asset.currentPrice) }}</td>
            <td class="text-right">{{ formatCurrency(asset.averageCost) }}</td>
            <td class="text-right font-semibold">{{ formatShares(asset.shares) }}</td>
            <td class="text-right">{{ formatCurrency(asset.costBasis) }}</td>
            <td class="text-right font-semibold" :class="asset.unrealizedPL >= 0 ? 'pl-positive' : 'pl-negative'">
              {{ formatCurrency(asset.unrealizedPL) }}
            </td>
            <td class="text-right font-semibold" :class="asset.unrealizedPLPercent >= 0 ? 'pl-positive' : 'pl-negative'">
              {{ formatPercent(asset.unrealizedPLPercent) }}
            </td>
            <td class="text-right font-semibold">{{ asset.weight }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.live-price-col {
  color: #2dd4bf;
}

.live-price-cell {
  color: #2dd4bf;
  font-weight: 600;
}
</style>
