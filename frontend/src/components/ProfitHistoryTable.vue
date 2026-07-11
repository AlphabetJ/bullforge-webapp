<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  profitHistory: {
    type: Array,
    required: true
  }
});

// Search filters
const searchQuery = ref('');

// Sorting
const sortBy = ref('lastTransactionDate');
const sortDesc = ref(true);

const handleSort = (field) => {
  if (sortBy.value === field) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortBy.value = field;
    sortDesc.value = false;
  }
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(val || 0);
};

const formatPercent = (val) => {
  return `${val >= 0 ? '+' : ''}${(val || 0).toFixed(2)}%`;
};

const formatShares = (val) => {
  return typeof val === 'number' ? val.toFixed(2) : Number(val).toFixed(2);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

// Summary metrics
const totalRealizedPL = computed(() => {
  return props.profitHistory.reduce((sum, item) => sum + item.realizedPL, 0);
});

const winRate = computed(() => {
  if (props.profitHistory.length === 0) return 0;
  const wins = props.profitHistory.filter(item => item.realizedPL > 0).length;
  return (wins / props.profitHistory.length) * 100;
});

// Group by symbol to compute aggregated performance for the top cards
const symbolAggregates = computed(() => {
  const groups = {};
  props.profitHistory.forEach(item => {
    if (!groups[item.symbol]) {
      groups[item.symbol] = {
        symbol: item.symbol,
        realizedPL: 0,
        totalInvested: 0
      };
    }
    groups[item.symbol].realizedPL += item.realizedPL;
    groups[item.symbol].totalInvested += item.totalInvested;
  });

  return Object.values(groups).map(g => ({
    symbol: g.symbol,
    realizedPL: g.realizedPL,
    realizedPLPercent: g.totalInvested > 0 ? (g.realizedPL / g.totalInvested) * 100 : 0
  }));
});

const bestTrade = computed(() => {
  if (symbolAggregates.value.length === 0) return null;
  return [...symbolAggregates.value].sort((a, b) => b.realizedPL - a.realizedPL)[0];
});

const worstTrade = computed(() => {
  if (symbolAggregates.value.length === 0) return null;
  return [...symbolAggregates.value].sort((a, b) => a.realizedPL - b.realizedPL)[0];
});

// Processed list (Search, Sort)
const processedHistory = computed(() => {
  let list = [...props.profitHistory];

  // Search filter
  if (searchQuery.value) {
    const q = searchQuery.value.toUpperCase().trim();
    list = list.filter(item => item.symbol.includes(q));
  }

  // Sorting
  list.sort((a, b) => {
    let valA = a[sortBy.value];
    let valB = b[sortBy.value];

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortDesc.value ? 1 : -1;
    if (valA > valB) return sortDesc.value ? -1 : 1;
    return 0;
  });

  return list;
});
</script>

<template>
  <div class="profit-history-container">
    <!-- performance highlights -->
    <section class="grid-summary">
      <!-- Total Realized P&L Card -->
      <div class="card summary-card" :class="totalRealizedPL >= 0 ? 'success' : 'danger'">
        <div>
          <div class="summary-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            Net Realized Profit
          </div>
          <div class="summary-value" :class="totalRealizedPL >= 0 ? 'pl-positive' : 'pl-negative'">
            {{ formatCurrency(totalRealizedPL) }}
          </div>
        </div>
        <div class="summary-change neutral">
          From {{ profitHistory.length }} closed transactions
        </div>
      </div>

      <!-- Win Rate Card -->
      <div class="card summary-card" :class="winRate >= 50 ? 'success' : 'warning'">
        <div>
          <div class="summary-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Win Rate
          </div>
          <div class="summary-value" :class="winRate >= 50 ? 'pl-positive' : 'pl-negative'">
            {{ winRate.toFixed(1) }}%
          </div>
        </div>
        <div class="summary-change neutral">
          {{ profitHistory.filter(item => item.realizedPL > 0).length }} profitable / {{ profitHistory.length }} total
        </div>
      </div>

      <!-- Best Performing Trade -->
      <div v-if="bestTrade" class="card summary-card success">
        <div>
          <div class="summary-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            Best Performance
          </div>
          <div class="summary-value pl-positive">
            {{ formatCurrency(bestTrade.realizedPL) }}
          </div>
        </div>
        <div class="summary-change neutral" style="display: flex; gap: 0.35rem; align-items: center;">
          <span class="stock-symbol-badge" style="font-size: 0.7rem; padding: 0.1rem 0.3rem;">{{ bestTrade.symbol }}</span>
          ROI: {{ formatPercent(bestTrade.realizedPLPercent) }}
        </div>
      </div>

      <!-- Worst Performing Trade -->
      <div v-if="worstTrade" class="card summary-card danger">
        <div>
          <div class="summary-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
            Worst Performance
          </div>
          <div class="summary-value pl-negative">
            {{ formatCurrency(worstTrade.realizedPL) }}
          </div>
        </div>
        <div class="summary-change neutral" style="display: flex; gap: 0.35rem; align-items: center;">
          <span class="stock-symbol-badge" style="font-size: 0.7rem; padding: 0.1rem 0.3rem;">{{ worstTrade.symbol }}</span>
          ROI: {{ formatPercent(worstTrade.realizedPLPercent) }}
        </div>
      </div>
    </section>

    <!-- Table Card -->
    <div class="card fade-in-up">
      <div class="table-header-controls">
        <h2 class="section-title" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Profit History
        </h2>

        <!-- Search Section -->
        <div class="filters-row">
          <input 
            v-model="searchQuery" 
            type="text" 
            class="form-control search-input" 
            placeholder="Search stock..." 
          />
        </div>
      </div>

      <div v-if="processedHistory.length === 0" class="empty-state">
        <div class="empty-state-icon">📈</div>
        <div class="empty-state-title">No Trade History Found</div>
        <p v-if="searchQuery">No results match your search filters.</p>
        <p v-else>Stocks will appear here once they have both BUY and SELL transactions recorded.</p>
      </div>

      <div v-else class="table-container" style="max-height: 600px; overflow-y: auto;">
        <table>
          <thead>
            <tr>
              <th @click="handleSort('symbol')" class="sortable">
                Stock
                <span v-if="sortBy === 'symbol'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('sharesSold')" class="sortable text-right">
                Shares Sold
                <span v-if="sortBy === 'sharesSold'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('avgBuyPrice')" class="sortable text-right">
                Avg Buy
                <span v-if="sortBy === 'avgBuyPrice'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('avgSellPrice')" class="sortable text-right">
                Avg Sell
                <span v-if="sortBy === 'avgSellPrice'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('totalInvested')" class="sortable text-right">
                Total Cost
                <span v-if="sortBy === 'totalInvested'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('totalProceeds')" class="sortable text-right">
                Net Proceeds
                <span v-if="sortBy === 'totalProceeds'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('totalFees')" class="sortable text-right">
                Fees
                <span v-if="sortBy === 'totalFees'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('realizedPL')" class="sortable text-right">
                Gain/Loss
                <span v-if="sortBy === 'realizedPL'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('realizedPLPercent')" class="sortable text-right">
                ROI
                <span v-if="sortBy === 'realizedPLPercent'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
              <th @click="handleSort('lastTransactionDate')" class="sortable text-right">
                Closed Date
                <span v-if="sortBy === 'lastTransactionDate'">{{ sortDesc ? '▼' : '▲' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in processedHistory" :key="item.id">
              <td>
                <span class="stock-symbol-badge">{{ item.symbol }}</span>
              </td>
              <td class="text-right font-semibold">{{ formatShares(item.sharesSold) }}</td>
              <td class="text-right">{{ formatCurrency(item.avgBuyPrice) }}</td>
              <td class="text-right">{{ formatCurrency(item.avgSellPrice) }}</td>
              <td class="text-right">{{ formatCurrency(item.totalInvested) }}</td>
              <td class="text-right">{{ formatCurrency(item.totalProceeds) }}</td>
              <td class="text-right text-muted">{{ formatCurrency(item.totalFees) }}</td>
              <td class="text-right font-semibold" :class="item.realizedPL >= 0 ? 'pl-positive' : 'pl-negative'">
                {{ formatCurrency(item.realizedPL) }}
              </td>
              <td class="text-right font-semibold" :class="item.realizedPLPercent >= 0 ? 'pl-positive' : 'pl-negative'">
                {{ formatPercent(item.realizedPLPercent) }}
              </td>
              <td class="text-right text-muted" style="font-size: 0.85rem;">{{ formatDate(item.lastTransactionDate) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-header-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 0.75rem;
}

.filters-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.search-input {
  max-width: 200px;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  border-radius: var(--radius-sm);
}

.filter-select {
  max-width: 150px;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 0.85rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.sortable {
  cursor: pointer;
  user-select: none;
  transition: color var(--transition-fast);
}

.sortable:hover {
  color: var(--text-primary);
}

.badge-success-dim {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.badge-danger-dim {
  background: rgba(244, 63, 94, 0.1);
  color: var(--danger);
  border: 1px solid rgba(244, 63, 94, 0.2);
}

@media (max-width: 768px) {
  .table-header-controls {
    flex-direction: column;
    align-items: stretch;
  }
  .filters-row {
    flex-direction: column;
    align-items: stretch;
  }
  .search-input, .filter-select {
    max-width: 100%;
  }
}
</style>
