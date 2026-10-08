<script setup>
import { ref, watch, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  holdings: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['add-transaction', 'reset-portfolio']);

// Form fields
const type = ref('BUY'); // Default to BUY to avoid accidental SELL entries
const symbol = ref('');
const shares = ref(1);
const price = ref(0);
const fees = ref(0);
const dividendReinvestment = ref(false);
const toLocalIso = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const date = ref(toLocalIso(new Date()));

// Date format conversion helpers (ISO YYYY-MM-DD <-> DD/MM/YYYY)
const isoToDMY = (isoStr) => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return isoStr;
};

const dmyToIso = (dmyStr) => {
  if (!dmyStr) return '';
  const clean = dmyStr.trim();
  const parts = clean.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d && m && y && y.length === 4) {
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      const year = parseInt(y, 10);
      const parsed = new Date(year, month - 1, day);
      if (day >= 1 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100 && parsed.getDate() === day && parsed.getMonth() === month - 1) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  return '';
};

const calendarOpen = ref(false);
const calendarAbove = ref(false);
const calendarRoot = ref(null);
const calendarTrigger = ref(null);
const calendarPanel = ref(null);
const displayDate = ref(isoToDMY(date.value));
const visibleMonth = ref(date.value ? new Date(`${date.value}T00:00:00`) : new Date());

const monthLabel = computed(() => visibleMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
const calendarDays = computed(() => {
  const year = visibleMonth.value.getFullYear();
  const month = visibleMonth.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(year, month, index - startOffset + 1);
    const iso = toLocalIso(cell);
    return { key: iso, day: cell.getDate(), iso, outside: cell.getMonth() !== month,
      label: cell.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) };
  });
});

const todayIso = (() => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
})();

const shiftMonth = (amount) => {
  visibleMonth.value = new Date(visibleMonth.value.getFullYear(), visibleMonth.value.getMonth() + amount, 1);
};

const closeCalendar = () => {
  calendarOpen.value = false;
  calendarTrigger.value?.focus();
};

const selectDate = (iso) => {
  date.value = iso;
  closeCalendar();
};

const handleCalendarClickOutside = (event) => {
  if (calendarRoot.value && !calendarRoot.value.contains(event.target)) {
    calendarOpen.value = false;
  }
};

const handleCalendarKeydown = (event) => {
  if (event.key === 'Escape' && calendarOpen.value) closeCalendar();
};

onMounted(() => {
  document.addEventListener('pointerdown', handleCalendarClickOutside);
  document.addEventListener('keydown', handleCalendarKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleCalendarClickOutside);
  document.removeEventListener('keydown', handleCalendarKeydown);
});

watch(date, (newIsoDate) => {
  const formatted = isoToDMY(newIsoDate);
  if (formatted !== displayDate.value) {
    displayDate.value = formatted;
  }
});

const handleDisplayDateInput = (e) => {
  let val = e.target.value;
  displayDate.value = val;
  const iso = dmyToIso(val);
  if (iso) {
    date.value = iso;
  } else {
    date.value = '';
  }
};

const openDatePicker = async () => {
  if (date.value) visibleMonth.value = new Date(`${date.value}T00:00:00`);
  calendarOpen.value = !calendarOpen.value;
  if (calendarOpen.value) {
    calendarAbove.value = false;
    await nextTick();
    const anchor = calendarRoot.value.getBoundingClientRect();
    const height = calendarPanel.value.offsetHeight;
    calendarAbove.value = window.innerHeight - anchor.bottom < height + 16 && anchor.top > height + 16;
    await nextTick();
    const panel = calendarPanel.value;
    const initialDay = panel?.querySelector('.selected') || panel?.querySelector('.today') || panel?.querySelector('.calendar-day:not(.outside)');
    initialDay?.focus({ preventScroll: true });
  }
};

const errorMsg = ref('');
const successMsg = ref('');

// Computed dropdown list of owned stocks for selling
const ownedStocks = computed(() => {
  return props.holdings.filter(h => h.shares > 0);
});

// Auto-fill price and reset fields when symbol changes
watch(symbol, (newSymbol) => {
  if (!newSymbol) return;
  
  if (type.value === 'SELL') {
    const asset = props.holdings.find(h => h.symbol === newSymbol);
    if (asset) {
      // Auto-fill price with the current market price of the holding
      price.value = asset.currentPrice;
      // Cap shares to what's owned
      if (shares.value > asset.shares) {
        shares.value = asset.shares;
      }
    }
  } else {
    // BUY mode
    price.value = 0;
  }
});

// Reset symbol when type switches
watch(type, (newType) => {
  dividendReinvestment.value = false;
  symbol.value = '';
  shares.value = 1;
  price.value = 0;
  fees.value = 0;
  errorMsg.value = '';
});

// Current asset if found
const selectedAsset = computed(() => {
  if (!symbol.value) return null;
  return props.holdings.find(h => h.symbol === symbol.value);
});

// Real-time calculations for previews
const totalTransactionValue = computed(() => {
  const rawValue = (shares.value || 0) * (price.value || 0);
  if (type.value === 'BUY') {
    return rawValue + (fees.value || 0); // Cost including fees
  } else {
    return rawValue - (fees.value || 0); // Net proceeds after fees
  }
});

// Profit / Loss calculation preview for SELL mode
const sellProfitLoss = computed(() => {
  if (type.value !== 'SELL' || !selectedAsset.value) return 0;
  const avgCost = selectedAsset.value.averageCost;
  const proceeds = ((price.value || 0) * (shares.value || 0)) - (fees.value || 0);
  const costBasis = (shares.value || 0) * avgCost;
  return proceeds - costBasis;
});

const sellProfitLossPercent = computed(() => {
  if (type.value !== 'SELL' || !selectedAsset.value || selectedAsset.value.averageCost === 0) return 0;
  const avgCost = selectedAsset.value.averageCost;
  const costBasis = (shares.value || 0) * avgCost;
  if (costBasis === 0) return 0;
  return (sellProfitLoss.value / costBasis) * 100;
});

const remainingShares = computed(() => {
  if (!selectedAsset.value) return 0;
  return Math.max(0, selectedAsset.value.shares - (shares.value || 0));
});

const formatShares = (val) => {
  const num = typeof val === 'number' ? val : Number(val) || 0;
  if (num > 0 && num < 0.01) {
    return '< 0.01';
  }
  return num.toFixed(2);
};

// Validation
const isValid = computed(() => {
  if (!symbol.value) return false;
  if (!shares.value || shares.value <= 0) return false;
  if (!price.value || price.value <= 0) return false;
  if (fees.value === undefined || fees.value < 0) return false;
  if (!date.value) return false;

  if (type.value === 'SELL' && selectedAsset.value) {
    if (shares.value > selectedAsset.value.shares) {
      return false;
    }
  }
  return true;
});

const submitForm = () => {
  errorMsg.value = '';
  successMsg.value = '';

  if (!isValid.value) {
    if (type.value === 'SELL' && selectedAsset.value && shares.value > selectedAsset.value.shares) {
      errorMsg.value = `Cannot sell more than owned (${selectedAsset.value.shares} shares).`;
    } else {
      errorMsg.value = 'Please fill out all fields correctly.';
    }
    return;
  }

  const txData = {
    symbol: symbol.value.toUpperCase().trim(),
    type: type.value,
    shares: parseFloat(shares.value),
    price: parseFloat(price.value),
    fees: parseFloat(fees.value || 0),
    date: date.value,
    source: type.value === 'BUY' && dividendReinvestment.value ? 'DIVIDEND_REINVESTMENT' : 'TRADE'
  };

  emit('add-transaction', txData, (success, msg) => {
    if (success) {
      successMsg.value = `Successfully recorded ${type.value} of ${shares.value} ${symbol.value}!`;
      // Reset form fields
      shares.value = 1;
      fees.value = 0;
      dividendReinvestment.value = false;
      // If we sold everything, reset symbol selector
      if (type.value === 'SELL' && remainingShares.value === 0) {
        symbol.value = '';
      }
      setTimeout(() => {
        successMsg.value = '';
      }, 3000);
    } else {
      errorMsg.value = msg || 'Failed to submit transaction.';
    }
  });
};
</script>

<template>
  <div class="card fade-in-up">
    <h2 class="section-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
      Record Transaction
    </h2>

    <div class="type-selector">
      <div 
        class="type-option" 
        :class="{ active: type === 'BUY', BUY: true }"
        @click="type = 'BUY'"
      >
        BUY ASSET
      </div>
      <div 
        class="type-option" 
        :class="{ active: type === 'SELL', SELL: true }"
        @click="type = 'SELL'"
      >
        SELL ASSET
      </div>
    </div>

    <form @submit.prevent="submitForm">
      <!-- Symbol selection for SELL mode -->
      <div v-if="type === 'SELL'" class="form-group">
        <label class="form-label">Select Stock to Sell</label>
        <select v-model="symbol" class="form-control" required>
          <option value="" disabled selected>-- Select an asset --</option>
          <option v-for="stock in ownedStocks" :key="stock.symbol" :value="stock.symbol">
            {{ stock.symbol }} (Owned: {{ formatShares(stock.shares) }} shares)
          </option>
        </select>
      </div>

      <!-- Symbol input for BUY mode -->
      <div v-else class="form-group">
        <label class="form-label">Stock Symbol</label>
        <input 
          v-model="symbol" 
          type="text" 
          class="form-control" 
          placeholder="e.g. AAPL, AMZN, NVDA" 
          required
        />
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Number of Shares</label>
          <input 
            v-model.number="shares" 
            type="number" 
            step="any"
            min="0.0001"
            class="form-control" 
            required
            :max="type === 'SELL' && selectedAsset ? selectedAsset.shares : undefined"
          />
        </div>

        <div class="form-group">
          <label class="form-label">Price per Share ($)</label>
          <input 
            v-model.number="price" 
            type="number" 
            step="0.01" 
            min="0.01"
            class="form-control" 
            required
          />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="form-group">
          <label class="form-label">Transaction Fees ($)</label>
          <input 
            v-model.number="fees" 
            type="number" 
            step="0.01" 
            min="0"
            class="form-control" 
            required
          />
        </div>

        <div class="form-group">
          <label for="transaction-date" class="form-label">Date of Transaction</label>
          <div ref="calendarRoot" class="date-input-wrapper" @focusout="(event) => { if (!event.currentTarget.contains(event.relatedTarget)) calendarOpen = false; }">
            <input 
              id="transaction-date"
              type="text" 
              :value="displayDate" 
              @input="handleDisplayDateInput"
              placeholder="DD/MM/YYYY" 
              class="form-control date-text-input" 
              required
              pattern="\d{2}/\d{2}/\d{4}"
              title="Please use DD/MM/YYYY format (e.g. 12/08/2026)"
            />
            <button 
              ref="calendarTrigger"
              type="button" 
              class="calendar-btn calendar-trigger"
              @click="openDatePicker"
              :aria-expanded="calendarOpen"
              aria-haspopup="dialog"
              aria-label="Open transaction date calendar"
              title="Select date"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="4"></line>
                <line x1="8" y1="2" x2="8" y2="4"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </button>
            <Transition name="calendar-popover">
              <div v-if="calendarOpen" ref="calendarPanel" class="calendar-popover" :class="{ 'calendar-above': calendarAbove }" role="dialog" aria-label="Choose transaction date">
                <div class="calendar-heading">
                  <div>
                    <span class="calendar-eyebrow">Transaction date</span>
                    <strong>{{ monthLabel }}</strong>
                  </div>
                  <div class="calendar-nav">
                    <button type="button" aria-label="Previous month" @click="shiftMonth(-1)">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <button type="button" aria-label="Next month" @click="shiftMonth(1)">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                  </div>
                </div>
                <div class="calendar-grid calendar-weekdays" aria-hidden="true">
                  <span v-for="weekday in ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']" :key="weekday">{{ weekday }}</span>
                </div>
                <div class="calendar-grid calendar-dates">
                  <span v-for="cell in calendarDays" :key="cell.key" class="calendar-day-cell">
                    <button
                      type="button"
                      class="calendar-day"
                      :class="{ selected: date === cell.iso, today: todayIso === cell.iso, outside: cell.outside }"
                      :aria-label="cell.label"
                      :aria-current="todayIso === cell.iso ? 'date' : undefined"
                      :aria-pressed="date === cell.iso"
                      @click="selectDate(cell.iso)"
                    >{{ cell.day }}</button>
                  </span>
                </div>
                <div class="calendar-footer">
                  <span><i class="calendar-today-dot"></i> Today · {{ isoToDMY(todayIso) }}</span>
                  <button type="button" @click="selectDate(todayIso)">Today</button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>

      <!-- LIVE REAL-TIME CALCULATION PREVIEW BOX -->
      <div v-if="symbol" class="calc-preview">
        <div class="calc-row">
          <span class="calc-label">Subtotal (Shares × Price):</span>
          <span class="calc-value">${{ ((shares || 0) * (price || 0)).toFixed(2) }}</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">Fees:</span>
          <span class="calc-value">${{ (fees || 0).toFixed(2) }}</span>
        </div>
        <div class="calc-row">
          <span class="calc-label">{{ type === 'BUY' ? 'Total Cost (incl. fees):' : 'Net Proceeds (after fees):' }}</span>
          <span class="calc-value" style="color: var(--text-primary); font-size: 0.95rem;">${{ totalTransactionValue.toFixed(2) }}</span>
        </div>

        <!-- Extra sell-specific calculations -->
        <template v-if="type === 'SELL' && selectedAsset">
          <div class="calc-row">
            <span class="calc-label">Avg Buy Cost:</span>
            <span class="calc-value">${{ selectedAsset.averageCost.toFixed(2) }}</span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Cost Basis of Sold Shares:</span>
            <span class="calc-value">${{ ((shares || 0) * selectedAsset.averageCost).toFixed(2) }}</span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Remaining Shares:</span>
            <span class="calc-value">{{ formatShares(remainingShares) }} / {{ formatShares(selectedAsset.shares) }}</span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Net Realized Return:</span>
            <span 
              class="calc-value" 
              :class="sellProfitLoss >= 0 ? 'pl-positive' : 'pl-negative'"
            >
              ${{ sellProfitLoss.toFixed(2) }} 
              ({{ sellProfitLossPercent >= 0 ? '+' : '' }}{{ sellProfitLossPercent.toFixed(2) }}%)
            </span>
          </div>
        </template>
      </div>

      <div v-if="errorMsg" style="color: var(--danger); font-size: 0.85rem; margin-top: 1rem; font-weight: 500;">
        ⚠ {{ errorMsg }}
      </div>

      <div v-if="successMsg" style="color: var(--success); font-size: 0.85rem; margin-top: 1rem; font-weight: 500;">
        ✓ {{ successMsg }}
      </div>

      <div v-if="type === 'BUY'" class="income-source-choice">
        <label><input type="checkbox" v-model="dividendReinvestment" /> ซื้อซ้ำจากเงินปันผล (DRIP)</label>
        <p class="muted">เลือกเฉพาะเมื่อเงินปันผลถูกนำมาซื้อหน่วยเพิ่ม มูลค่าซื้อรวมค่าธรรมเนียมจะบันทึกเป็นปันผลลงทุนซ้ำและเป็นต้นทุนของหน่วยใหม่</p>
      </div>

      <div class="btn-row">
        <button 
          type="submit" 
          class="btn btn-primary"
          :disabled="!isValid"
          :style="{ opacity: isValid ? 1 : 0.6 }"
        >
          Submit Transaction
        </button>
      </div>
    </form>

    <details style="margin-top: 2rem; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 1rem;">
      <summary class="muted">Advanced: replace portfolio with demo data</summary>
      <p class="muted">This permanently replaces all transaction records.</p>
      <button 
        type="button" 
        class="btn btn-secondary" 
        style="width: 100%; font-size: 0.8rem; padding: 0.5rem;"
        @click="$emit('reset-portfolio')"
      >
        Replace All Transactions with Demo Data
      </button>
    </details>
  </div>
</template>

<!-- Unscoped, uniquely named calendar classes also survive adding styles during Vite HMR. -->
<style>
.date-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.date-text-input {
  padding-right: 2.8rem;
}

.calendar-trigger {
  position: absolute;
  right: 0.55rem;
  display: grid;
  place-items: center;
  padding: 0.4rem;
  color: var(--text-secondary);
  background: transparent;
  border: 0;
  border-radius: 0.55rem;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease;
}

.calendar-trigger:hover,
.calendar-trigger:focus-visible {
  color: var(--text-primary);
  background: rgba(148, 163, 184, 0.14);
  outline: none;
}

.calendar-popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 0.65rem);
  right: 0;
  width: min(20rem, calc(100vw - 3rem));
  padding: 1.15rem;
  color: var(--text-primary);
  background: linear-gradient(145deg, #202b40, #172132 70%);
  border: 1px solid #39435c;
  border-radius: 1.2rem;
  box-shadow: 0 24px 60px #060b18a6, 0 0 0 4px #0b0f194d, inset 0 1px 0 #ffffff08;
}

.calendar-heading,
.calendar-nav,
.calendar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.calendar-popover.calendar-above {
  top: auto;
  bottom: calc(100% + 0.65rem);
  transform-origin: bottom right;
}

.calendar-heading {
  margin-bottom: 1rem;
}

.calendar-heading > div:first-child {
  display: grid;
  gap: 0.2rem;
}

.calendar-eyebrow {
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.calendar-heading strong {
  font-size: 1.15rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.calendar-nav {
  gap: 0.35rem;
}

.calendar-nav button {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  color: var(--text-secondary);
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.6rem;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease, transform 160ms ease;
}

.calendar-nav button:hover {
  color: var(--text-primary);
  background: rgba(148, 163, 184, 0.2);
  transform: translateY(-1px);
}

.calendar-nav svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  text-align: center;
}

.calendar-weekdays {
  margin-bottom: 0.35rem;
  color: var(--text-secondary);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.calendar-weekdays span {
  padding: 0.4rem 0;
}

.calendar-day-cell {
  display: grid;
  min-height: 2.5rem;
  place-items: center;
}

.calendar-day {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.82rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.65rem;
  cursor: pointer;
  transition: color 140ms ease, background 140ms ease, border-color 140ms ease, transform 140ms ease;
}

.calendar-day:hover {
  background: rgba(148, 163, 184, 0.15);
  transform: scale(1.06);
}

.calendar-day.today {
  color: #a5b4fc;
  border-color: #818cf880;
}

.calendar-day.outside { color: #65748b; }

.calendar-day:focus-visible,
.calendar-nav button:focus-visible,
.calendar-footer button:focus-visible {
  outline: 2px solid #a5b4fc;
  outline-offset: 2px;
}

.calendar-day.selected {
  color: #fff;
  background: linear-gradient(135deg, #818cf8, #6366f1);
  border-color: var(--primary, #6366f1);
  box-shadow: 0 5px 14px rgba(99, 102, 241, 0.32);
}

.calendar-footer {
  gap: 0.5rem;
  margin-top: 0.8rem;
  padding-top: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.7rem;
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.calendar-footer > span { display: flex; align-items: center; gap: 0.4rem; }
.calendar-today-dot { width: 5px; height: 5px; border-radius: 50%; background: #a5b4fc; }

.calendar-footer button {
  padding: 0.35rem 0.6rem;
  color: #c7d2fe;
  font: inherit;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.12);
  border: 0;
  border-radius: 0.5rem;
  cursor: pointer;
}

.calendar-footer button:hover {
  background: rgba(99, 102, 241, 0.2);
}

.calendar-popover-enter-active,
.calendar-popover-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
  transform-origin: top right;
}

.calendar-popover-enter-from,
.calendar-popover-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .calendar-popover, .calendar-popover *, .calendar-trigger {
    transition-duration: 0.01ms !important;
  }
}
</style>

<style scoped>
.income-source-choice { margin-top:1rem; font-size:.85rem; }
.income-source-choice label { display:flex; gap:.5rem; align-items:center; }
.income-source-choice p { font-size:.8rem; margin-top:.5rem; line-height:1.7; }
details summary { cursor:pointer; font-size:.8rem; }
</style>
