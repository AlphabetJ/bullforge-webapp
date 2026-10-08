<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  holdings: {
    type: Array,
    required: true
  }
});

// Active holdings with shares > 0
const ownedStocks = computed(() => {
  return props.holdings.filter(h => h.shares > 0);
});

// Selected stock symbol
const selectedSymbol = ref('');

// Watch holdings to select first stock by default if available
watch(
  ownedStocks,
  (stocks) => {
    if (stocks.length > 0 && (!selectedSymbol.value || !stocks.some(s => s.symbol === selectedSymbol.value))) {
      selectedSymbol.value = stocks[0].symbol;
    }
  },
  { immediate: true }
);

// Current selected stock object
const selectedStock = computed(() => {
  return ownedStocks.value.find(s => s.symbol === selectedSymbol.value) || null;
});

// Interactive state
const targetPercent = ref(10);
const targetPrice = ref(0);
const targetProfit = ref(0);

// Rounding helper
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Update derived values from target percent
const updateFromPercent = (pct) => {
  if (!selectedStock.value) return;
  const avg = selectedStock.value.shares > 0 ? selectedStock.value.costBasis / selectedStock.value.shares : 0;
  const shs = selectedStock.value.shares || 0;
  
  targetPercent.value = Math.max(-100, pct);
  const price = Math.max(0.01, round2(avg * (1 + targetPercent.value / 100)));
  targetPrice.value = price;
  targetProfit.value = round2(shs * price - selectedStock.value.costBasis);
};

// Update derived values from target price
const updateFromPrice = (price) => {
  if (!selectedStock.value) return;
  const avg = selectedStock.value.shares > 0 ? selectedStock.value.costBasis / selectedStock.value.shares : 0;
  const shs = selectedStock.value.shares || 0;

  price = Math.max(0.01, round2(price));
  targetPrice.value = price;
  if (avg > 0) {
    targetPercent.value = round2(((price - avg) / avg) * 100);
  } else {
    targetPercent.value = 0;
  }
  targetProfit.value = round2(shs * price - selectedStock.value.costBasis);
};

// Update derived values from target profit in dollars
const updateFromProfit = (profit) => {
  if (!selectedStock.value) return;
  const avg = selectedStock.value.shares > 0 ? selectedStock.value.costBasis / selectedStock.value.shares : 0;
  const shs = selectedStock.value.shares || 0;

  if (shs > 0) updateFromPrice(avg + profit / shs);
};

// When selected stock changes, initialize simulation to default +10%
watch(
  selectedStock,
  (newStock) => {
    if (newStock) {
      updateFromPercent(10);
    }
  },
  { immediate: true }
);

// Quick preset options
const presets = [
  { label: '-15%', val: -15, type: 'loss' },
  { label: '-10%', val: -10, type: 'loss' },
  { label: '-5%', val: -5, type: 'loss' },
  { label: '0% (ทุน)', val: 0, type: 'neutral' },
  { label: '+5%', val: 5, type: 'profit' },
  { label: '+10%', val: 10, type: 'profit' },
  { label: '+15%', val: 15, type: 'profit' },
  { label: '+20%', val: 20, type: 'profit' },
  { label: '+25%', val: 25, type: 'profit' },
  { label: '+30%', val: 30, type: 'profit' },
  { label: '+50%', val: 50, type: 'profit' },
  { label: '+100%', val: 100, type: 'profit' }
];

// Calculated outputs
const totalProceeds = computed(() => {
  if (!selectedStock.value) return 0;
  return (selectedStock.value.shares || 0) * (targetPrice.value || 0);
});

// Comparison with current market price
const marketDiff = computed(() => {
  if (!selectedStock.value) return { dollar: 0, percent: 0 };
  const current = selectedStock.value.currentPrice || 0;
  const target = targetPrice.value || 0;
  const dollarDiff = target - current;
  const percentDiff = current > 0 ? (dollarDiff / current) * 100 : 0;
  return {
    dollar: dollarDiff,
    percent: percentDiff
  };
});

// Scenario matrix data for selected stock
const scenarioSteps = [-15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 50, 100];
const scenarioMatrix = computed(() => {
  if (!selectedStock.value) return [];
  const avg = selectedStock.value.shares > 0 ? selectedStock.value.costBasis / selectedStock.value.shares : 0;
  const shs = selectedStock.value.shares || 0;
  const current = selectedStock.value.currentPrice || 0;

  return scenarioSteps.map(pct => {
    const price = round2(avg * (1 + pct / 100));
    const profit = round2(shs * price - selectedStock.value.costBasis);
    const cash = round2(shs * price);
    const mktDiffPct = current > 0 ? ((price - current) / current) * 100 : 0;
    const isCurrentActive = Math.abs(targetPercent.value - pct) < 0.01;

    return {
      percent: pct,
      price,
      profit,
      cash,
      mktDiffPct,
      isActive: isCurrentActive
    };
  });
});

const priceMarkers = computed(() => {
  if (!selectedStock.value) return [];
  const items = [
    { label: 'Cost / share', value: selectedStock.value.costBasis / selectedStock.value.shares, color: '#94a3b8' },
    { label: 'Market', value: selectedStock.value.currentPrice, color: '#22d3ee' },
    { label: 'Target', value: targetPrice.value, color: '#a5b4fc' }
  ];
  const min = Math.min(...items.map(item => item.value));
  const max = Math.max(...items.map(item => item.value));
  return items.sort((a, b) => a.value - b.value).map(item => ({ ...item, x: 25 + (item.value - min) / (max - min || 1) * 450 }));
});

// Formatters
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val || 0);
};

const formatShares = (val) => {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  if (num > 0 && num < 0.01) return '< 0.01';
  return num.toFixed(2);
};

const formatPercent = (val) => {
  return `${val >= 0 ? '+' : ''}${(val || 0).toFixed(2)}%`;
};
</script>

<template>
  <div class="simulator-container">
    <!-- Header Title Banner -->
    <div class="card sim-header-card fade-in-up">
      <div class="sim-header-content">
        <!-- Stock Selector Dropdown -->
        <div v-if="ownedStocks.length > 0" class="sim-selector-group">
          <label class="form-label" style="margin-bottom: 0.35rem;">Choose Asset to Simulate</label>
          <select v-model="selectedSymbol" class="form-control sim-select">
            <option v-for="stock in ownedStocks" :key="stock.symbol" :value="stock.symbol">
              {{ stock.symbol }} — {{ formatShares(stock.shares) }} shares (Avg ${{ stock.averageCost.toFixed(2) }})
            </option>
          </select>
        </div>
        <p class="sim-subtitle">จำลองขายหุ้นที่เลือกทั้งหมด · ผลลัพธ์ก่อนค่าธรรมเนียมขาย</p>
      </div>
    </div>

    <!-- Empty State if no holdings -->
    <div v-if="ownedStocks.length === 0" class="card empty-state fade-in-up">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">No Active Holdings Available</div>
      <p>คุณยังไม่มีรายการหุ้นที่ถือครองในพอร์ต กรุณาบันทึกการซื้อหุ้นในแท็บ Transactions ก่อนใช้งานเครื่องมือจำลอง</p>
    </div>

    <!-- Main Content when stock is selected -->
    <div v-else-if="selectedStock" class="sim-body">
      <!-- Stock Snapshot Bar -->
      <div class="card stock-snapshot-card fade-in-up">
        <div class="snapshot-badge-col">
          <span class="stock-symbol-badge main-symbol">{{ selectedStock.symbol }}</span>
          <span class="snapshot-shares">Full Position: <strong>{{ formatShares(selectedStock.shares) }}</strong> shares</span>
        </div>

        <div class="snapshot-metrics-grid">
          <div class="snapshot-metric">
            <span class="snapshot-label">Average Buy Cost</span>
            <span class="snapshot-val">{{ formatCurrency(selectedStock.averageCost) }}</span>
          </div>

          <div class="snapshot-metric">
            <span class="snapshot-label">Total Cost Basis</span>
            <span class="snapshot-val">{{ formatCurrency(selectedStock.costBasis) }}</span>
          </div>

          <div class="snapshot-metric">
            <span class="snapshot-label">Current Market Price</span>
            <span class="snapshot-val live-price-col">{{ formatCurrency(selectedStock.currentPrice) }}</span><small v-if="selectedStock.priceSource === 'cost-fallback'" class="muted">Estimated using average cost</small>
          </div>

          <div class="snapshot-metric">
            <span class="snapshot-label">Current Unrealized P/L</span>
            <span 
              class="snapshot-val" 
              :class="selectedStock.unrealizedPL >= 0 ? 'pl-positive' : 'pl-negative'"
            >
              {{ formatCurrency(selectedStock.unrealizedPL) }} ({{ formatPercent(selectedStock.unrealizedPLPercent) }})
            </span>
          </div>
        </div>
      </div>

      <!-- Interactive 2-Way Calculator Form -->
      <div class="sim-grid-two-col">
        <!-- Input Panel -->
        <div class="card sim-calculator-card fade-in-up">
          <h2 class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2"></rect>
              <line x1="8" y1="6" x2="16" y2="6"></line>
              <line x1="16" y1="14" x2="16" y2="18"></line>
              <path d="M16 10h.01"></path>
              <path d="M12 10h.01"></path>
              <path d="M8 10h.01"></path>
              <path d="M12 14h.01"></path>
              <path d="M8 14h.01"></path>
              <path d="M12 18h.01"></path>
              <path d="M8 18h.01"></path>
            </svg>
            Interactive Target Planner
          </h2>

      <!-- Quick Preset Buttons -->
      <div class="presets-card inline-presets">
        <div class="presets-header">
          <div class="presets-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Quick Target Presets
          </div>
          <span class="presets-desc">คลิกปุ่มเพื่อจำลองเป้าหมายกำไรหรือจุดตัดขาดทุนทันที</span>
        </div>

        <div class="preset-chips">
          <button 
            v-for="p in presets" 
            :key="p.val" 
            type="button" 
            class="preset-chip"
            :class="[p.type, { active: Math.abs(targetPercent - p.val) < 0.01 }]"
            @click="updateFromPercent(p.val)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

          <div class="sim-fields">
            <!-- 1. Target Percent -->
            <div class="form-group sim-input-group">
              <div class="sim-label-row">
                <label class="form-label">1. Target Profit / Return (%)</label>
                <span class="sim-input-hint">คำนวณจากต้นทุน ${{ selectedStock.averageCost.toFixed(2) }}</span>
              </div>
              <div class="input-with-suffix">
                <input 
                  type="number" 
                  step="0.1" 
                  :value="targetPercent"
                  @input="e => updateFromPercent(parseFloat(e.target.value) || 0)"
                  class="form-control highlight-input"
                  placeholder="e.g. 10, 20, -5"
                />
                <span class="input-suffix">%</span>
              </div>
            </div>

            <!-- 2. Target Selling Price -->
            <div class="form-group sim-input-group">
              <div class="sim-label-row">
                <label class="form-label">2. Target Sell Price ($)</label>
                <span class="sim-input-hint">ราคาขายต่อหุ้น</span>
              </div>
              <div class="input-with-suffix">
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  :value="targetPrice"
                  @input="e => updateFromPrice(parseFloat(e.target.value) || 0)"
                  class="form-control"
                  placeholder="e.g. 150.00"
                />
                <span class="input-suffix">$</span>
              </div>
            </div>

            <!-- 3. Desired Net Profit Amount -->
            <div class="form-group sim-input-group">
              <div class="sim-label-row">
                <label class="form-label">3. Desired Profit Amount ($)</label>
                <span class="sim-input-hint">กำไรตัวเงินรวม ({{ formatShares(selectedStock.shares) }} หุ้น)</span>
              </div>
              <div class="input-with-suffix">
                <input 
                  type="number" 
                  step="1" 
                  :value="targetProfit"
                  @input="e => updateFromProfit(parseFloat(e.target.value) || 0)"
                  class="form-control"
                  placeholder="e.g. 500"
                />
                <span class="input-suffix">$</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Live Results Summary Display -->
        <div class="card sim-results-card fade-in-up">
          <h2 class="section-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Simulation Outcome
          </h2>

          <div class="price-comparison">
            <svg viewBox="0 0 500 40" role="img" aria-label="Cost, market and target price comparison"><line x1="25" x2="475" y1="20" y2="20" stroke="#475569" stroke-width="3"/><circle v-for="marker in priceMarkers" :key="marker.label" :cx="marker.x" cy="20" r="7" :fill="marker.color"><title>{{ marker.label }}: {{ formatCurrency(marker.value) }}</title></circle></svg>
            <div class="price-marker-labels"><div v-for="marker in priceMarkers" :key="marker.label" :style="{color:marker.color}"><small>{{ marker.label }}</small><strong>{{ formatCurrency(marker.value) }}</strong></div></div>
          </div>

          <div class="outcome-cards-grid">
            <!-- Target Selling Price -->
            <div class="outcome-card">
              <span class="outcome-label">Target Selling Price</span>
              <div class="outcome-value primary-gradient-text">{{ formatCurrency(targetPrice) }}</div>
              <span class="outcome-sub">ต่อหุ้น (Per Share)</span>
            </div>

            <!-- Total Cash Proceeds -->
            <div class="outcome-card">
              <span class="outcome-label">Total Cash Proceeds</span>
              <div class="outcome-value">{{ formatCurrency(totalProceeds) }}</div>
              <span class="outcome-sub">เงินขายหุ้นที่เลือกทั้งหมด ก่อนค่าธรรมเนียม</span>
            </div>

            <!-- Realized Profit / Loss -->
            <div class="outcome-card" :class="targetProfit >= 0 ? 'card-success-border' : 'card-danger-border'">
              <span class="outcome-label">Expected P/L (before sell fees)</span>
              <div 
                class="outcome-value" 
                :class="targetProfit >= 0 ? 'pl-positive' : 'pl-negative'"
              >
                {{ formatCurrency(targetProfit) }}
              </div>
              <span 
                class="outcome-sub" 
                :class="targetPercent >= 0 ? 'pl-positive' : 'pl-negative'"
              >
                Return: {{ formatPercent(targetPercent) }}
              </span>
            </div>

            <!-- Needed From Current Market Price -->
            <div class="outcome-card" :class="marketDiff.dollar >= 0 ? 'card-info-border' : 'card-warning-border'">
              <span class="outcome-label">Distance from Market Price</span>
              <div 
                class="outcome-value" 
                :class="marketDiff.dollar >= 0 ? 'color-cyan' : 'color-orange'"
              >
                {{ marketDiff.dollar >= 0 ? '+' : '' }}{{ formatCurrency(marketDiff.dollar) }}
              </div>
              <span 
                class="outcome-sub" 
                :class="marketDiff.percent >= 0 ? 'color-cyan' : 'color-orange'"
              >
                {{ marketDiff.percent >= 0 ? 'Upside needed: +' : 'Below market: ' }}{{ marketDiff.percent.toFixed(2) }}%
              </span>
            </div>
          </div>

          <!-- Market Price Distance Insight Banner -->
          <div 
            class="market-insight-banner" 
            :class="marketDiff.dollar >= 0 ? 'banner-upside' : 'banner-below'"
          >
            <div class="banner-icon">
              <span v-if="marketDiff.dollar > 0">🚀</span>
              <span v-else-if="marketDiff.dollar === 0">🎯</span>
              <span v-else>⚠️</span>
            </div>
            <div class="banner-text">
              <strong v-if="marketDiff.dollar > 0">
                ราคาตลาดปัจจุบัน (${{ selectedStock.currentPrice.toFixed(2) }}) ต้องปรับตัวขึ้นอีก +{{ marketDiff.percent.toFixed(2) }}%
              </strong>
              <strong v-else-if="marketDiff.dollar === 0">
                ราคาเป้าหมายตรงกับราคาตลาดปัจจุบันพอดี (${{ selectedStock.currentPrice.toFixed(2) }})
              </strong>
              <strong v-else>
                ราคาเป้าหมายนี้ต่ำกว่าราคาตลาดปัจจุบัน (${{ selectedStock.currentPrice.toFixed(2) }}) อยู่ {{ Math.abs(marketDiff.percent).toFixed(2) }}%
              </strong>
              <div class="banner-sub">
                เมื่อขาย {{ formatShares(selectedStock.shares) }} หุ้นที่ราคา ${{ targetPrice.toFixed(2) }} จะได้รับเงินสดรวม {{ formatCurrency(totalProceeds) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Multi-Scenario Matrix Table -->
      <div class="card matrix-card fade-in-up">
        <div class="matrix-header">
          <div>
            <h2 class="section-title" style="margin-bottom: 0.25rem; border-bottom: none; padding-bottom: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Quick Scenario Matrix (ทุกช่วงผลตอบแทน)
            </h2>
            <p class="sim-subtitle" style="margin-bottom: 0;">คลิกที่แถวใดก็ได้เพื่อโหลดค่านั้นขึ้นไปปรับแต่งในเครื่องคำนวณด้านบน</p>
          </div>
        </div>

        <div class="table-container" style="margin-top: 1rem;">
          <table class="scenario-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th class="text-right">Target Price</th>
                <th class="text-right">Total Cash Inflow</th>
                <th class="text-right">P/L before sell fees</th>
                <th class="text-right">Distance from Market</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="row in scenarioMatrix" 
                :key="row.percent"
                :class="{ 'row-active': row.isActive }"
                @click="updateFromPercent(row.percent)"
                style="cursor: pointer;"
              >
                <td>
                  <span 
                    class="scenario-badge"
                    :class="{
                      'badge-stoploss': row.percent < 0,
                      'badge-breakeven': row.percent === 0,
                      'badge-profit': row.percent > 0
                    }"
                  >
                    {{ row.percent === 0 ? 'Breakeven (0%)' : formatPercent(row.percent) }}
                  </span>
                </td>
                <td class="text-right font-semibold">{{ formatCurrency(row.price) }}</td>
                <td class="text-right">{{ formatCurrency(row.cash) }}</td>
                <td 
                  class="text-right font-semibold"
                  :class="row.profit >= 0 ? 'pl-positive' : 'pl-negative'"
                >
                  {{ row.profit >= 0 ? '+' : '' }}{{ formatCurrency(row.profit) }}
                </td>
                <td class="text-right">
                  <span :class="row.mktDiffPct >= 0 ? 'color-cyan' : 'color-orange'">
                    {{ row.mktDiffPct >= 0 ? '+' : '' }}{{ row.mktDiffPct.toFixed(2) }}%
                  </span>
                </td>
                <td class="text-center">
                  <button 
                    type="button" 
                    class="btn-select-scenario"
                    :class="{ selected: row.isActive }"
                    @click.stop="updateFromPercent(row.percent)"
                  >
                    {{ row.isActive ? 'Active' : 'Apply' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.simulator-container {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin-bottom: 3rem;
}

.sim-body {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* Header Banner */
.sim-header-card {
  padding: 1.5rem 1.75rem;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%);
}

.sim-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.sim-header-title-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sim-icon-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 0 15px var(--primary-glow);
  flex-shrink: 0;
}

.sim-main-title {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.2rem;
}

.sim-subtitle {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.sim-selector-group {
  min-width: 280px;
}

.sim-select {
  font-weight: 600;
  cursor: pointer;
}

/* Stock Snapshot Card */
.stock-snapshot-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  background: rgba(30, 41, 59, 0.5);
  flex-wrap: wrap;
}

.snapshot-badge-col {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.main-symbol {
  font-size: 1.15rem;
  padding: 0.35rem 0.8rem;
  letter-spacing: 0.05em;
  width: fit-content;
}

.snapshot-shares {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.snapshot-metrics-grid {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.snapshot-metric {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.snapshot-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.snapshot-val {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
}

/* Quick Presets Card */
.presets-card {
  padding: 1.25rem 1.5rem;
  background: rgba(15, 23, 42, 0.6);
}

.presets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.presets-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
}

.presets-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.preset-chip {
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  font-family: var(--font-sans);
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.preset-chip:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.preset-chip.profit {
  border-color: rgba(16, 185, 129, 0.2);
}
.preset-chip.profit:hover {
  border-color: var(--success);
  color: var(--success);
}
.preset-chip.profit.active {
  background: var(--success);
  border-color: var(--success);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
}

.preset-chip.loss {
  border-color: rgba(244, 63, 94, 0.2);
}
.preset-chip.loss:hover {
  border-color: var(--danger);
  color: var(--danger);
}
.preset-chip.loss.active {
  background: var(--danger);
  border-color: var(--danger);
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(244, 63, 94, 0.3);
}

.preset-chip.neutral.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
  box-shadow: 0 2px 10px var(--primary-glow);
}

/* Two-column layout */
.sim-grid-two-col {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 1.5rem;
  align-items: stretch;
}

@media (max-width: 960px) {
  .sim-grid-two-col {
    grid-template-columns: 1fr;
  }
}

/* Calculator Card */
.sim-calculator-card {
  display: flex;
  flex-direction: column;
}

.sim-fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.sim-input-group {
  margin-bottom: 0;
}

.sim-label-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.35rem;
}

.sim-input-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-suffix input {
  padding-right: 2.25rem;
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
}

.input-suffix {
  position: absolute;
  right: 1rem;
  color: var(--text-muted);
  font-weight: 600;
  pointer-events: none;
}

.highlight-input {
  border-color: rgba(99, 102, 241, 0.4);
}

/* Results Card */
.sim-results-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.outcome-cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.outcome-card {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  padding: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  transition: all var(--transition-fast);
}

.outcome-card:hover {
  background: rgba(15, 23, 42, 0.8);
}

.outcome-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.outcome-value {
  font-family: var(--font-display);
  font-size: 1.45rem;
  font-weight: 700;
}

.outcome-sub {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.primary-gradient-text {
  background: linear-gradient(135deg, #a5b4fc 0%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.card-success-border {
  border-left: 3px solid var(--success);
}

.card-danger-border {
  border-left: 3px solid var(--danger);
}

.card-info-border {
  border-left: 3px solid var(--secondary);
}

.card-warning-border {
  border-left: 3px solid var(--warning);
}

.color-cyan {
  color: var(--secondary);
}

.color-orange {
  color: var(--warning);
}

/* Market Insight Banner */
.market-insight-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.15rem 1.25rem;
  border-radius: var(--radius-md);
  margin-top: 1.5rem;
}

.banner-upside {
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.2);
}

.banner-below {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.banner-icon {
  font-size: 1.5rem;
}

.banner-text {
  font-size: 0.85rem;
  color: var(--text-primary);
  line-height: 1.4;
}

.banner-sub {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
}

/* Scenario Matrix */
.matrix-card {
  padding: 1.5rem 1.75rem;
}

.matrix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.scenario-table tr {
  cursor: pointer;
}

.scenario-table tr.row-active td {
  background: rgba(99, 102, 241, 0.12);
}

.scenario-badge {
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  display: inline-block;
}

.badge-profit {
  background: var(--success-bg);
  color: var(--success);
}

.badge-stoploss {
  background: var(--danger-bg);
  color: var(--danger);
}

.badge-breakeven {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.btn-select-scenario {
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-select-scenario:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
}

.btn-select-scenario.selected {
  background: var(--primary);
  border-color: var(--primary);
  color: #ffffff;
  font-weight: 700;
}
</style>

<style scoped>
.sim-header-card { padding:1.25rem; }
.sim-body { gap:1rem; }
.sim-main-title { font-size:1.3rem; }
.price-comparison { margin-bottom:1rem; background:#ffffff04; padding:.75rem; border-radius:10px; }
.price-comparison svg { display:block; width:100%; }
.price-marker-labels { display:grid; grid-template-columns:repeat(3,1fr); gap:.5rem; text-align:center; }
.price-marker-labels small, .price-marker-labels strong { display:block; font-size:.75rem; }
.price-marker-labels strong { font-size:.95rem; margin-top:.25rem; }
</style>

<style scoped>
.sim-header-card { margin-bottom:1rem; }
.sim-header-content { gap:1rem; }
.sim-selector-group { min-width:0; width:min(100%,420px); }
.inline-presets { padding:.75rem; border-radius:10px; margin-bottom:1rem; }
.inline-presets .presets-desc { display:none; }
.inline-presets .presets-header { margin-bottom:.6rem; }
.inline-presets .preset-chip { font-size:.75rem; padding:.35rem .55rem; }
.snapshot-metrics-grid { gap:1.25rem; }
</style>
