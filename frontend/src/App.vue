<script setup>
import { ref, computed, onMounted } from 'vue';
import StockChart from './components/StockChart.vue';
import StockTable from './components/StockTable.vue';
import SalesForm from './components/SalesForm.vue';
import ProfitHistoryTable from './components/ProfitHistoryTable.vue';
import SellSimulator from './components/SellSimulator.vue';
import { currency, percent, shares, dateLabel, monthLabel } from './utils/format';
const activeTab = ref('dashboard');
const tabs = [{ id:'dashboard', label:'Dashboard' }, { id:'profit-history', label:'Profit History' }, { id:'transactions', label:'Transactions' }, { id:'simulator', label:'Sell Simulator' }];
const titles = { dashboard:['Portfolio overview','Your holdings, current value and returns at a glance.'], 'profit-history':['Profit & income','Review your realized returns and sale history.'], transactions:['Transactions','Record activity and review your investment history.'], simulator:['Plan a sale','Explore target prices for a selected position.'] };
const loading = ref(false);
const hasLoaded = ref(false);
const error = ref('');
const portfolio = ref({ holdings: [], profitHistory: [], dividendHistory: [], summary: {} });
const transactions = ref([]);
const search = ref('');
const action = ref('All');
const month = ref('All');
const months = computed(() => [...new Set(transactions.value.map(tx => tx.date.slice(0,7)))].sort().reverse());
const filteredTransactions = computed(() => transactions.value.filter(tx => (!search.value.trim() || tx.symbol.includes(search.value.trim().toUpperCase())) && (action.value === 'All' || tx.type === action.value) && (month.value === 'All' || tx.date.startsWith(month.value))));
const summary = computed(() => portfolio.value.summary);
const priceFallbacks = computed(() => portfolio.value.holdings.filter(asset => asset.priceSource === 'cost-fallback').map(asset => asset.symbol));
const updatedAt = computed(() => summary.value.calculatedAt ? new Date(summary.value.calculatedAt).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Bangkok' }) : '');
const isDrip = tx => tx.source === 'DIVIDEND_REINVESTMENT' || (!tx.source && tx.symbol === 'JEPQ' && tx.type === 'BUY' && tx.fees === 0 && tx.shares < 1 && String(tx.id).startsWith('csv_'));
async function loadAllData() {
  loading.value = true; error.value = '';
  try {
    const [portfolioResponse, transactionResponse] = await Promise.all([fetch('/api/portfolio'), fetch('/api/transactions')]);
    if (!portfolioResponse.ok || !transactionResponse.ok) throw new Error('Unable to load portfolio data. Please retry.');
    const [nextPortfolio, nextTransactions] = await Promise.all([portfolioResponse.json(), transactionResponse.json()]);
    portfolio.value = nextPortfolio; transactions.value = nextTransactions; hasLoaded.value = true;
  } catch (err) { error.value = err.message || 'Network error. Please retry.'; }
  finally { loading.value = false; }
}
async function handleAddTransaction(txData, callback) {
  try {
    const response = await fetch('/api/transactions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(txData) });
    const data = await response.json();
    if (!response.ok) return callback(false, data.error || 'Unable to record transaction.');
    await loadAllData();
    callback(true);
  } catch { callback(false, 'Network error. Please retry.'); }
}
async function handleResetPortfolio() {
  if (!confirm('This permanently replaces ALL your transactions with demo data. Continue?')) return;
  try {
    const response = await fetch('/api/transactions?reset=true', {method:'DELETE'});
    if (!response.ok) throw new Error('Unable to reset data.');
    await loadAllData();
  } catch (err) { error.value = err.message; }
}
onMounted(loadAllData);
</script>
<template>
  <div class="app-container">
    <header class="header">
      <div class="brand-section"><div class="brand-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17V7m5 10v-4m5 4V9m5 8V4"/></svg></div><span class="brand-name">Jateyanooo's Portfolio</span></div>
      <nav class="nav-tabs" aria-label="Main navigation"><button v-for="tab in tabs" :key="tab.id" class="tab-btn" :class="{active:activeTab === tab.id}" :aria-current="activeTab === tab.id ? 'page' : undefined" @click="activeTab = tab.id"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-if="tab.id === 'dashboard'" d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/><path v-else-if="tab.id === 'profit-history'" d="M4 4v16h16M8 15l4-5 4 2 4-7"/><path v-else-if="tab.id === 'transactions'" d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/><path v-else d="M4 20V4h16v16H4zm4-12h8m-8 4h2m4 0h2m-8 4h2m4 0h2"/></svg>{{ tab.label }}</button></nav>
    </header>
    <div class="page-heading"><div><h1>{{ titles[activeTab][0] }}</h1><p class="muted">{{ titles[activeTab][1] }}</p></div><div class="refresh-tools"><span v-if="updatedAt" class="muted">Calculated {{ updatedAt }} ICT · USD</span><button class="compact-button" :disabled="loading" @click="loadAllData"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M18 17a7 7 0 0 1-12 1l-2-3"/></svg>{{ loading ? 'Refreshing…' : 'Refresh' }}</button></div></div>
    <div v-if="error" class="error-banner" role="alert">{{ error }} <button class="compact-button" :disabled="loading" @click="loadAllData">Retry</button><p v-if="hasLoaded">Showing previously loaded data.</p></div>
    <div v-if="loading && !hasLoaded" class="loader-container"><div class="loader"></div><p>Loading your portfolio…</p></div>
    <main v-if="hasLoaded" :aria-busy="loading">
      <p v-if="activeTab !== 'simulator'" class="period-note muted">Tracking from {{ dateLabel(summary.periodStart) }} · average-cost method · recorded fees included</p>
      <template v-if="activeTab === 'dashboard'">
        <section class="grid-summary metrics-four" aria-label="Portfolio summary">
          <div class="card summary-card primary"><span class="summary-label">{{ summary.valuationIsEstimated ? 'Estimated holdings value' : 'Holdings market value' }}</span><strong class="summary-value">{{ currency(summary.totalCurrentValue) }}</strong><small class="muted">{{ portfolio.holdings.length }} assets · excludes cash balance</small></div>
          <div class="card summary-card"><span class="summary-label">Open-position cost</span><strong class="summary-value">{{ currency(summary.totalCapitalInvested) }}</strong><small class="muted">Remaining cost basis, including buy fees</small></div>
          <div class="card summary-card"><span class="summary-label">Unrealized P/L</span><strong class="summary-value" :class="summary.totalUnrealizedPL >= 0 ? 'pl-positive' : 'pl-negative'">{{ currency(summary.totalUnrealizedPL) }}</strong><small :class="summary.totalUnrealizedPL >= 0 ? 'pl-positive' : 'pl-negative'">{{ percent(summary.totalUnrealizedPLPercent) }} · open positions</small></div>
          <div class="card summary-card"><span class="summary-label">Realized sale P/L</span><strong class="summary-value" :class="summary.totalRealizedPL >= 0 ? 'pl-positive' : 'pl-negative'">{{ currency(summary.totalRealizedPL) }}</strong><button class="text-link" @click="activeTab = 'profit-history'">All sales · view dividends separately →</button></div>
        </section>
        <div v-if="priceFallbacks.length" class="notice-banner" role="status">Market prices unavailable for {{ priceFallbacks.join(', ') }}. Those holdings use average cost as an estimate; unrealized P/L and weights are provisional.</div>
        <section class="grid-dashboard"><StockTable :holdings="portfolio.holdings"/><StockChart :holdings="portfolio.holdings"/></section>
      </template>
      <ProfitHistoryTable v-if="activeTab === 'profit-history'" :profitHistory="portfolio.profitHistory" :dividendHistory="portfolio.dividendHistory" :summary="summary"/>
      <section v-if="activeTab === 'transactions'" class="transactions-view">
        <div class="transaction-layout">
          <div class="transaction-form-column">
            <SalesForm :holdings="portfolio.holdings" @add-transaction="handleAddTransaction" @reset-portfolio="handleResetPortfolio"/>
          </div>
          <div class="card activity-card">
            <div class="panel-heading"><div><h2>Activity</h2><p class="muted">{{ filteredTransactions.length }} of {{ transactions.length }} transactions</p></div></div>
            <div class="transaction-filters"><input v-model="search" class="form-control" placeholder="Search asset…" aria-label="Search transactions by asset"/><select v-model="action" class="compact-select" aria-label="Transaction action"><option value="All">All actions</option><option value="BUY">Buy</option><option value="SELL">Sell</option></select><select v-model="month" class="compact-select" aria-label="Transaction month"><option value="All">All time</option><option v-for="key in months" :key="key" :value="key">{{ monthLabel(key) }}</option></select></div>
          <div v-if="!filteredTransactions.length" class="empty-state">No transactions match your filters.</div>
          <div v-else class="table-container ledger-table"><table><thead><tr><th>Date</th><th>Asset</th><th>Activity</th><th class="text-right">Shares</th><th class="text-right">Price</th><th class="text-right">Fees</th><th class="text-right">Amount</th></tr></thead><tbody><tr v-for="tx in filteredTransactions" :key="tx.id"><td>{{ dateLabel(tx.date) }}</td><td><span class="stock-symbol-badge">{{ tx.symbol }}</span></td><td><span class="badge" :class="isDrip(tx) ? 'badge-income' : tx.type === 'BUY' ? 'badge-success' : 'badge-danger'">{{ isDrip(tx) ? 'DRIP' : tx.type }}</span><small v-if="isDrip(tx)" class="table-subline">{{ tx.source ? 'Recorded dividend' : 'Estimated dividend' }}</small></td><td class="text-right">{{ shares(tx.shares) }}</td><td class="text-right">{{ currency(tx.price) }}</td><td class="text-right">{{ currency(tx.fees) }}</td><td class="text-right font-semibold">{{ currency(tx.shares * tx.price + (tx.type === 'BUY' ? 1 : -1) * (tx.fees || 0)) }}<small class="table-subline">{{ tx.type === 'BUY' ? 'Purchase cost' : 'Net sale proceeds' }}</small></td></tr></tbody></table></div>
        </div>
        </div>
      </section>
      <SellSimulator v-if="activeTab === 'simulator'" :holdings="portfolio.holdings"/>
    </main>
  </div>
</template>
<style scoped>
.brand-logo { font-size:1.4rem; font-weight:700; }
.transaction-layout { display:grid; grid-template-columns:minmax(320px,2fr) minmax(0,3fr); align-items:start; gap:20px; }
.transaction-form-column, .activity-card { min-width:0; }
.activity-card { padding:24px; }
.activity-card .panel-heading { margin-bottom:.75rem; }
.transactions-view .ledger-table { max-height:680px; }
.transactions-view .ledger-table table { min-width:760px; }
.transaction-filters { display:flex; flex-wrap:wrap; gap:.75rem; margin-bottom:1rem; }
.transaction-filters .form-control { width:100%; max-width:none; padding:.5rem .75rem; }
.transaction-filters .compact-select { flex:1 1 120px; min-width:0; }
.refresh-tools { display:flex; align-items:center; flex-wrap:wrap; gap:.75rem; font-size:.75rem; }
.period-note { font-size:.75rem; margin-bottom:1rem; }
.badge-income { color:var(--primary); background:var(--primary-glow); }
@media(max-width:1050px) { .transaction-layout { grid-template-columns:1fr; } }
</style>
