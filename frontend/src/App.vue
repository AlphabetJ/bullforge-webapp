<script setup>
import { ref, onMounted } from 'vue';
import StockChart from './components/StockChart.vue';
import StockTable from './components/StockTable.vue';
import SalesForm from './components/SalesForm.vue';
import ProfitHistoryTable from './components/ProfitHistoryTable.vue';
import SellSimulator from './components/SellSimulator.vue';

const activeTab = ref('dashboard');
const loading = ref(true);
const portfolio = ref({
  holdings: [],
  profitHistory: [],
  summary: {
    totalCapitalInvested: 0,
    totalCurrentValue: 0,
    totalUnrealizedPL: 0,
    totalUnrealizedPLPercent: 0,
    totalRealizedPL: 0,
    netProfitLoss: 0,
    monthlyRealizedPL: { All: 0 }
  }
});
const transactions = ref([]);

const selectedMonth = ref('All');

const getSelectedRealizedPL = () => {
  if (!portfolio.value || !portfolio.value.summary) return 0;
  const breakdown = portfolio.value.summary.monthlyRealizedPL || {};
  return breakdown[selectedMonth.value] !== undefined ? breakdown[selectedMonth.value] : (portfolio.value.summary.totalRealizedPL || 0);
};

const formatMonthLabel = (key) => {
  if (!key || key === 'All') return 'All Time';
  const [year, month] = key.split('-');
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};


const fetchPortfolio = async () => {
  try {
    const res = await fetch('/api/portfolio');
    if (!res.ok) throw new Error('Failed to fetch portfolio');
    portfolio.value = await res.json();
  } catch (err) {
    console.error('Error loading portfolio:', err);
  }
};

const fetchTransactions = async () => {
  try {
    const res = await fetch('/api/transactions');
    if (!res.ok) throw new Error('Failed to fetch transactions');
    transactions.value = await res.json();
  } catch (err) {
    console.error('Error loading transactions:', err);
  }
};

const loadAllData = async () => {
  loading.value = true;
  await Promise.all([fetchPortfolio(), fetchTransactions()]);
  loading.value = false;
};

const handleAddTransaction = async (txData, callback) => {
  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(txData)
    });
    
    const data = await res.json();
    if (!res.ok) {
      callback(false, data.error || 'Failed to submit transaction');
    } else {
      await loadAllData();
      callback(true);
    }
  } catch (err) {
    console.error('Network error submitting transaction:', err);
    callback(false, 'Network error. Please try again.');
  }
};

const handleResetPortfolio = async () => {
  if (!confirm('Are you sure you want to reset all transaction history to seed data?')) return;
  
  try {
    loading.value = true;
    const res = await fetch('/api/transactions?reset=true', {
      method: 'DELETE'
    });
    if (res.ok) {
      await loadAllData();
    }
  } catch (err) {
    console.error('Error resetting database:', err);
  } finally {
    loading.value = false;
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

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

const formatShares = (val) => {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  if (num > 0 && num < 0.01) {
    return '< 0.01';
  }
  return num.toFixed(2);
};


onMounted(() => {
  loadAllData();
});
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <div class="brand-section">
        <div class="brand-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </div>
        <span class="brand-name">Jateyanooo's Portfolio</span>
      </div>

      <!-- Navigation Tabs -->
      <nav class="nav-tabs">
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'dashboard' }"
          @click="activeTab = 'dashboard'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
          Dashboard
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'profit-history' }"
          @click="activeTab = 'profit-history'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          Profit History
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'transactions' }"
          @click="activeTab = 'transactions'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Transactions
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: activeTab === 'simulator' }"
          @click="activeTab = 'simulator'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          Sell Simulator
        </button>
      </nav>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="loader-container">
      <div class="loader"></div>
      <p>Syncing portfolio metrics...</p>
    </div>

    <div v-else>
      <!-- Summary / Quick Stats Grid -->
      <section class="grid-summary">
        <!-- Portfolio Value Card -->
        <div class="card summary-card primary">
          <div>
            <div class="summary-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              Total Portfolio Value
            </div>
            <div class="summary-value">{{ formatCurrency(portfolio.summary.totalCapitalInvested) }}</div>
          </div>
          <div class="summary-change neutral">
            {{ portfolio.holdings.length }} Active Holdings
          </div>
        </div>

        <!-- Profit Taken Card -->
        <div class="card summary-card" :class="getSelectedRealizedPL() >= 0 ? 'success' : 'danger'">
          <div>
            <div class="summary-header-row">
              <div class="summary-label">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="4"></line><line x1="8" y1="2" x2="8" y2="4"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Profit Taken
              </div>
              <!-- Monthly Filter Dropdown -->
              <select v-model="selectedMonth" class="period-select" @click.stop>
                <option value="All">All Time</option>
                <option v-for="(val, key) in portfolio.summary.monthlyRealizedPL" :key="key" v-show="key !== 'All'" :value="key">
                  {{ formatMonthLabel(key) }}
                </option>
              </select>
            </div>
            <div class="summary-value" :class="getSelectedRealizedPL() >= 0 ? 'pl-positive' : 'pl-negative'">
              {{ formatCurrency(getSelectedRealizedPL()) }}
            </div>
          </div>
          <div 
            class="summary-change"
            :class="getSelectedRealizedPL() >= 0 ? 'up' : 'down'"
          >
            Realized Return ({{ selectedMonth === 'All' ? 'All Time' : formatMonthLabel(selectedMonth) }})
          </div>
        </div>
      </section>

      <!-- Dashboard View -->
      <section v-if="activeTab === 'dashboard'" class="grid-dashboard">
        <!-- Asset Table -->
        <StockTable :holdings="portfolio.holdings" />
        
        <!-- Asset Allocation Chart -->
        <StockChart :holdings="portfolio.holdings" :totalValue="portfolio.summary.totalCurrentValue" />
      </section>

      <!-- Profit History View -->
      <section v-if="activeTab === 'profit-history'">
        <ProfitHistoryTable :profitHistory="portfolio.profitHistory" />
      </section>

      <!-- Transaction/Sell View -->
      <section v-if="activeTab === 'transactions'" class="grid-dashboard">
        <!-- Sales and Buy Form -->
        <SalesForm 
          :holdings="portfolio.holdings" 
          @add-transaction="handleAddTransaction"
          @reset-portfolio="handleResetPortfolio"
        />

        <!-- Transaction Log -->
        <div class="card fade-in-up">
          <h2 class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Transaction History
          </h2>

          <div v-if="transactions.length === 0" class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No Transactions Yet</div>
            <p>Your trade log will appear here once you record buys or sells.</p>
          </div>

          <div v-else class="table-container" style="max-height: 480px; overflow-y: auto;">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Stock</th>
                  <th>Action</th>
                  <th class="text-right">Shares</th>
                  <th class="text-right">Price</th>
                  <th class="text-right">Fees</th>
                  <th class="text-right">Net Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tx in transactions" :key="tx.id">
                  <td>{{ formatDate(tx.date) }}</td>
                  <td>
                    <span class="stock-symbol-badge">{{ tx.symbol }}</span>
                  </td>
                  <td>
                    <span 
                      class="badge" 
                      :class="tx.type === 'BUY' ? 'badge-success' : 'badge-danger'"
                    >
                      {{ tx.type }}
                    </span>
                  </td>
                  <td class="text-right font-semibold">{{ formatShares(tx.shares) }}</td>
                  <td class="text-right">{{ formatCurrency(tx.price) }}</td>
                  <td class="text-right">{{ formatCurrency(tx.fees) }}</td>
                  <td class="text-right font-semibold">
                    {{ formatCurrency(tx.type === 'BUY' ? (tx.shares * tx.price) + (tx.fees || 0) : (tx.shares * tx.price) - (tx.fees || 0)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Sell Simulator View -->
      <section v-if="activeTab === 'simulator'">
        <SellSimulator :holdings="portfolio.holdings" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.summary-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.period-select {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid var(--panel-border);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 0.2rem 0.5rem;
  font-family: var(--font-sans);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: border-color var(--transition-fast);
}

.period-select:hover, .period-select:focus {
  border-color: var(--primary);
}

.period-select option {
  background: var(--bg-dark);
  color: var(--text-primary);
}
</style>
