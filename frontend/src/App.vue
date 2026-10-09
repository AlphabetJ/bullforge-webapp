<script setup>
import { ref, computed } from 'vue';
import { usePortfolio } from './composables/usePortfolio';
import TransactionHistory from './components/TransactionHistory.vue';
import StockChart from './components/StockChart.vue';
import StockTable from './components/StockTable.vue';
import SalesForm from './components/SalesForm.vue';
import ProfitHistoryTable from './components/ProfitHistoryTable.vue';
import SellSimulator from './components/SellSimulator.vue';
import { currency, percent, dateLabel } from './utils/format';
const theme = ref(
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
);
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme.value;
  document.documentElement.style.colorScheme = theme.value;
  try {
    localStorage.setItem('portfolio-theme', theme.value);
  } catch {}
}
const activeTab = ref('dashboard');
const transactionFilters = ref({ search: '', action: 'All', month: 'All' });
const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profit-history', label: 'Profit History' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'simulator', label: 'Sell Simulator' },
];
const titles = {
  dashboard: [
    'Portfolio overview',
    'Your holdings, current value and returns at a glance.',
  ],
  'profit-history': [
    'Profit & income',
    'Review your realized returns and sale history.',
  ],
  transactions: [
    'Transactions',
    'Record activity and review your investment history.',
  ],
  simulator: ['Plan a sale', 'Explore target prices for a selected position.'],
};
const {
  loading,
  hasLoaded,
  error,
  portfolio,
  transactions,
  loadAllData,
  handleAddTransaction,
  handleResetPortfolio,
} = usePortfolio();
const summary = computed(() => portfolio.value.summary);
const priceFallbacks = computed(() =>
  portfolio.value.holdings
    .filter((asset) => asset.priceSource === 'cost-fallback')
    .map((asset) => asset.symbol),
);
const updatedAt = computed(() =>
  summary.value.calculatedAt
    ? new Date(summary.value.calculatedAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
      })
    : '',
);
</script>
<template>
  <div class="app-container">
    <header class="header">
      <div class="brand-section">
        <div class="brand-logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 17V7m5 10v-4m5 4V9m5 8V4" />
          </svg>
        </div>
        <span class="brand-name">Jateyanooo's Portfolio</span>
      </div>
      <nav class="nav-tabs" aria-label="Main navigation">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          @click="activeTab = tab.id"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              v-if="tab.id === 'dashboard'"
              d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"
            />
            <path
              v-else-if="tab.id === 'profit-history'"
              d="M4 4v16h16M8 15l4-5 4 2 4-7"
            />
            <path
              v-else-if="tab.id === 'transactions'"
              d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"
            />
            <path
              v-else
              d="M4 20V4h16v16H4zm4-12h8m-8 4h2m4 0h2m-8 4h2m4 0h2"
            /></svg
          >{{ tab.label }}
        </button>
      </nav>
      <button
        class="theme-switch"
        type="button"
        role="switch"
        :aria-checked="theme === 'dark'"
        aria-label="Dark mode"
        :title="
          theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
        "
        @click="toggleTheme"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            v-if="theme === 'dark'"
            d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"
          />
          <g v-else>
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"
            />
          </g>
        </svg>
        <span class="theme-switch-label">Dark mode</span>
        <span
          class="theme-switch-track"
          :class="{ enabled: theme === 'dark' }"
          aria-hidden="true"
          ><span></span
        ></span>
      </button>
    </header>
    <div class="page-heading">
      <div>
        <h1>{{ titles[activeTab][0] }}</h1>
        <p class="muted">{{ titles[activeTab][1] }}</p>
      </div>
      <div class="refresh-tools">
        <span v-if="updatedAt" class="muted"
          >Calculated {{ updatedAt }} ICT · USD</span
        ><button
          class="compact-button"
          :disabled="loading"
          @click="loadAllData"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3"
            /></svg
          >{{ loading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </div>
    <div v-if="error" class="error-banner" role="alert">
      {{ error }}
      <button class="compact-button" :disabled="loading" @click="loadAllData">
        Retry
      </button>
      <p v-if="hasLoaded">Showing previously loaded data.</p>
    </div>
    <div v-if="loading && !hasLoaded" class="loader-container">
      <div class="loader"></div>
      <p>Loading your portfolio…</p>
    </div>
    <main v-if="hasLoaded" :aria-busy="loading">
      <p v-if="activeTab !== 'simulator'" class="period-note muted">
        Tracking from {{ dateLabel(summary.periodStart) }} · average-cost method
        · recorded fees included
      </p>
      <template v-if="activeTab === 'dashboard'">
        <section
          class="grid-summary metrics-four"
          aria-label="Portfolio summary"
        >
          <div class="card summary-card primary">
            <span class="summary-label">{{
              summary.valuationIsEstimated
                ? 'Estimated holdings value'
                : 'Holdings market value'
            }}</span
            ><strong class="summary-value">{{
              currency(summary.totalCurrentValue)
            }}</strong
            ><small class="muted"
              >{{ portfolio.holdings.length }} assets · excludes cash
              balance</small
            >
          </div>
          <div class="card summary-card">
            <span class="summary-label">Open-position cost</span
            ><strong class="summary-value">{{
              currency(summary.totalCapitalInvested)
            }}</strong
            ><small class="muted"
              >Remaining cost basis, including buy fees</small
            >
          </div>
          <div class="card summary-card">
            <span class="summary-label">Unrealized P/L</span
            ><strong
              class="summary-value"
              :class="
                summary.totalUnrealizedPL >= 0 ? 'pl-positive' : 'pl-negative'
              "
              >{{ currency(summary.totalUnrealizedPL) }}</strong
            ><small
              :class="
                summary.totalUnrealizedPL >= 0 ? 'pl-positive' : 'pl-negative'
              "
              >{{ percent(summary.totalUnrealizedPLPercent) }} · open
              positions</small
            >
          </div>
          <div class="card summary-card">
            <span class="summary-label">Realized sale P/L</span
            ><strong
              class="summary-value"
              :class="
                summary.totalRealizedPL >= 0 ? 'pl-positive' : 'pl-negative'
              "
              >{{ currency(summary.totalRealizedPL) }}</strong
            ><button class="text-link" @click="activeTab = 'profit-history'">
              All sales · view dividends separately →
            </button>
          </div>
        </section>
        <div v-if="priceFallbacks.length" class="notice-banner" role="status">
          Market prices unavailable for {{ priceFallbacks.join(', ') }}. Those
          holdings use average cost as an estimate; unrealized P/L and weights
          are provisional.
        </div>
        <section class="grid-dashboard">
          <StockTable :holdings="portfolio.holdings" /><StockChart
            :holdings="portfolio.holdings"
          />
        </section>
      </template>
      <ProfitHistoryTable
        v-if="activeTab === 'profit-history'"
        :profitHistory="portfolio.profitHistory"
        :dividendHistory="portfolio.dividendHistory"
        :summary="summary"
      />
      <section v-if="activeTab === 'transactions'" class="transactions-view">
        <div class="transaction-layout">
          <div class="transaction-form-column">
            <SalesForm
              :holdings="portfolio.holdings"
              @add-transaction="handleAddTransaction"
              @reset-portfolio="handleResetPortfolio"
            />
          </div>
          <TransactionHistory
            :transactions="transactions"
            v-model:filters="transactionFilters"
          />
        </div>
      </section>
      <SellSimulator
        v-if="activeTab === 'simulator'"
        :holdings="portfolio.holdings"
      />
    </main>
  </div>
</template>
<style scoped>
.brand-logo {
  font-size: 1.4rem;
  font-weight: 700;
}
.transaction-layout {
  display: grid;
  grid-template-columns: minmax(320px, 2fr) minmax(0, 3fr);
  align-items: start;
  gap: 20px;
}
.transaction-form-column {
  min-width: 0;
}
.refresh-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.75rem;
}
.period-note {
  font-size: 0.75rem;
  margin-bottom: 1rem;
}
@media (max-width: 1050px) {
  .transaction-layout {
    grid-template-columns: 1fr;
  }
}
</style>
