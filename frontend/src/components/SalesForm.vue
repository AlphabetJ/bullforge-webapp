<script setup>
import { ref, watch, computed } from 'vue';

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
const date = ref(new Date().toISOString().split('T')[0]);

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

// Validation
const isValid = computed(() => {
  if (!symbol.value) return false;
  if (!shares.value || shares.value <= 0) return false;
  if (!price.value || price.value <= 0) return false;
  if (fees.value === undefined || fees.value < 0) return false;

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
    date: date.value
  };

  emit('add-transaction', txData, (success, msg) => {
    if (success) {
      successMsg.value = `Successfully recorded ${type.value} of ${shares.value} ${symbol.value}!`;
      // Reset form fields
      shares.value = 1;
      fees.value = 0;
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
            {{ stock.symbol }} (Owned: {{ stock.shares }} shares)
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
          <label class="form-label">Date of Transaction</label>
          <input 
            v-model="date" 
            type="date" 
            class="form-control" 
            required
          />
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
            <span class="calc-value">{{ remainingShares }} / {{ selectedAsset.shares }}</span>
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

    <div style="margin-top: 2rem; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 1rem;">
      <h3 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem; font-weight: 600;">Developer Utility</h3>
      <button 
        type="button" 
        class="btn btn-secondary" 
        style="width: 100%; font-size: 0.8rem; padding: 0.5rem;"
        @click="$emit('reset-portfolio')"
      >
        Reset Database to Seed Data
      </button>
    </div>
  </div>
</template>
