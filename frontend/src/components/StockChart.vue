<script setup>
import { computed } from 'vue';

const props = defineProps({
  holdings: {
    type: Array,
    required: true
  },
  totalValue: {
    type: Number,
    required: true
  }
});

// Color palette for assets
const COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#a855f7', // Purple
  '#f43f5e', // Rose
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#14b8a6', // Teal
];

// Slice top 5 holdings by weight descending (they are already sorted by the backend)
const topFiveHoldings = computed(() => {
  return props.holdings.slice(0, 5);
});

const getColor = (index) => {
  return COLORS[index % COLORS.length];
};

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(val);
};
</script>

<template>
  <div class="card fade-in-up">
    <h2 class="section-title">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      Asset Allocation (Top 5)
    </h2>

    <div v-if="holdings.length === 0" class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-title">No Assets Owned</div>
      <p>Add buy transactions to see your asset allocation bar chart.</p>
    </div>

    <div v-else class="bar-chart-container" style="display: flex; flex-direction: column; gap: 1.25rem;">
      <div 
        v-for="(holding, index) in topFiveHoldings" 
        :key="holding.symbol" 
        class="bar-chart-row" 
        style="display: flex; flex-direction: column; gap: 0.35rem;"
      >
        <div class="bar-chart-info" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="legend-color" :style="{ backgroundColor: getColor(index), width: '8px', height: '8px' }"></span>
            <span class="stock-symbol-badge">{{ holding.symbol }}</span>
            <span style="color: var(--text-secondary); font-size: 0.8rem;">(Cost Basis: {{ formatCurrency(holding.costBasis) }})</span>
          </div>
          <span class="font-semibold">{{ holding.weight }}%</span>
        </div>
        <!-- Progress track -->
        <div class="progress-track" style="width: 100%; height: 10px; background: rgba(255, 255, 255, 0.05); border-radius: 5px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.03);">
          <!-- Progress bar filled -->
          <div 
            class="progress-fill" 
            :style="{ 
              width: `${holding.weight}%`, 
              backgroundColor: getColor(index), 
              boxShadow: `0 0 10px ${getColor(index)}40`,
              height: '100%',
              borderRadius: '5px',
              transition: 'width 0.8s ease'
            }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>
