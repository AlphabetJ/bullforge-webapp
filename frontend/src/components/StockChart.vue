<script setup>
import { computed, ref } from 'vue';
import { currency } from '../utils/format';
const props = defineProps({ holdings: { type: Array, required: true } });
const basis = ref('market');
const colors = ['#818cf8', '#22d3ee', '#fbbf24', '#c084fc', '#fb7185', '#34d399'];
const assets = computed(() => props.holdings.map(asset => ({ ...asset, allocation: basis.value === 'market' ? asset.weight : asset.costWeight, amount: basis.value === 'market' ? asset.currentValue : asset.costBasis })).sort((a, b) => b.allocation - a.allocation));
</script>
<template>
  <div class="card allocation-card">
    <div class="panel-heading"><div><h2>Allocation</h2><p class="muted">All holdings · {{ basis === 'market' ? 'market value' : 'cost basis' }}</p></div><select v-model="basis" class="compact-select" aria-label="Allocation basis"><option value="market">Market</option><option value="cost">Cost</option></select></div>
    <div v-if="!assets.length" class="empty-state">No assets to display.</div>
    <div v-else class="allocation-list">
      <div v-for="(asset, index) in assets" :key="asset.symbol">
        <div class="allocation-label"><strong>{{ asset.symbol }}</strong><span>{{ asset.allocation.toFixed(2) }}%</span></div>
        <div class="allocation-track"><div :style="{ width: `${asset.allocation}%`, background: colors[index % colors.length] }"></div></div>
        <small class="muted">{{ currency(asset.amount) }}</small>
      </div>
    </div>
  </div>
</template>
<style scoped>
.allocation-list { display:grid; gap:1rem; }
.allocation-label { display:flex; justify-content:space-between; font-size:.9rem; }
.allocation-track { height:8px; background:#ffffff0b; border-radius:8px; overflow:hidden; margin:.35rem 0 .2rem; }
.allocation-track > div { height:100%; border-radius:8px; transition:width .2s; }
</style>
