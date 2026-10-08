<script setup>
import AssetIdentity from './AssetIdentity.vue';
import { computed, ref, watch } from 'vue';
import { currency } from '../utils/format';

const props = defineProps({ holdings: { type: Array, required: true } });
const basis = ref('market');
const highlighted = ref(null);
const colors = Array.from(
  { length: 8 },
  (_, index) => `var(--chart-${index + 1})`,
);
const circumference = 2 * Math.PI * 80;
const basisLabel = computed(() =>
  basis.value === 'market' ? 'Market value' : 'Cost basis',
);
const assets = computed(() => {
  const symbols = props.holdings.map((asset) => asset.symbol).sort();
  const values = props.holdings.map((asset) => ({
    symbol: asset.symbol,
    amount: Math.max(
      0,
      Number(basis.value === 'market' ? asset.currentValue : asset.costBasis) ||
        0,
    ),
    color: colors[symbols.indexOf(asset.symbol) % colors.length],
  }));
  const total = values.reduce((sum, asset) => sum + asset.amount, 0);
  let offset = 0;
  return values
    .sort((a, b) => b.amount - a.amount)
    .map((asset) => {
      const allocation = total > 0 ? (asset.amount / total) * 100 : 0;
      const length = (allocation / 100) * circumference;
      const segment = { ...asset, allocation, length, offset };
      offset += length;
      return segment;
    });
});
const total = computed(() =>
  assets.value.reduce((sum, asset) => sum + asset.amount, 0),
);
const selected = computed(() =>
  assets.value.find((asset) => asset.symbol === highlighted.value),
);
watch(basis, () => {
  highlighted.value = null;
});
</script>

<template>
  <div class="card allocation-card">
    <div class="panel-heading">
      <div>
        <h2>Allocation</h2>
        <p class="muted">All holdings · {{ basisLabel.toLowerCase() }}</p>
      </div>
      <select
        v-model="basis"
        class="compact-select"
        aria-label="Allocation basis"
      >
        <option value="market">Market</option>
        <option value="cost">Cost</option>
      </select>
    </div>
    <div v-if="!assets.length" class="empty-state">No assets to display.</div>
    <template v-else>
      <div class="allocation-donut">
        <svg
          viewBox="0 0 220 220"
          role="img"
          :aria-label="`${basisLabel} allocation across ${assets.length} assets`"
        >
          <title>{{ basisLabel }} allocation</title>
          <desc>
            {{
              assets
                .map(
                  (asset) => `${asset.symbol}: ${asset.allocation.toFixed(2)}%`,
                )
                .join(', ')
            }}
          </desc>
          <circle class="donut-track" cx="110" cy="110" r="80" />
          <g transform="rotate(-90 110 110)">
            <circle
              v-for="asset in assets.filter((asset) => asset.length > 0)"
              :key="asset.symbol"
              class="allocation-segment"
              cx="110"
              cy="110"
              r="80"
              fill="none"
              :stroke="asset.color"
              :stroke-dasharray="`${asset.length} ${circumference - asset.length}`"
              :stroke-dashoffset="-asset.offset"
              :opacity="selected && selected.symbol !== asset.symbol ? 0.25 : 1"
              @mouseenter="highlighted = asset.symbol"
              @mouseleave="highlighted = null"
            >
              <title>
                {{ asset.symbol }} · {{ asset.allocation.toFixed(2) }}% ·
                {{ currency(asset.amount) }}
              </title>
            </circle>
          </g>
        </svg>
        <div class="donut-label" aria-hidden="true">
          <span>{{ selected ? selected.symbol : basisLabel }}</span>
          <strong>{{
            selected ? selected.allocation.toFixed(2) + '%' : currency(total)
          }}</strong>
          <small>{{
            selected ? currency(selected.amount) : assets.length + ' assets'
          }}</small>
        </div>
      </div>
      <p v-if="!total" class="allocation-note muted">
        No value available for this allocation basis.
      </p>
      <ul class="allocation-list" aria-label="Allocation by asset">
        <li v-for="asset in assets" :key="asset.symbol">
          <button
            class="allocation-item"
            type="button"
            :class="{ highlighted: selected?.symbol === asset.symbol }"
            @mouseenter="highlighted = asset.symbol"
            @mouseleave="highlighted = null"
            @focus="highlighted = asset.symbol"
            @blur="highlighted = null"
            @click="
              highlighted = highlighted === asset.symbol ? null : asset.symbol
            "
            :aria-label="`${asset.symbol}: ${asset.allocation.toFixed(2)}%, ${currency(asset.amount)}`"
          >
            <span
              class="allocation-dot"
              :style="{ background: asset.color }"
              aria-hidden="true"
            ></span>
            <span class="allocation-asset"
              ><AssetIdentity :symbol="asset.symbol" /><small
                class="allocation-amount"
                >{{ currency(asset.amount) }}</small
              ></span
            >
            <span class="allocation-percent"
              >{{ asset.allocation.toFixed(2) }}%</span
            >
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.allocation-card .panel-heading {
  gap: 12px;
}
.allocation-donut {
  position: relative;
  width: min(100%, 240px);
  margin: 0 auto 20px;
  aspect-ratio: 1;
}
.allocation-donut svg {
  display: block;
  width: 100%;
  height: 100%;
}
.donut-track {
  fill: none;
  stroke: var(--bg-dark);
  stroke-width: 25;
}
.allocation-segment {
  stroke-width: 25;
  transition: opacity var(--transition-fast);
}
.donut-label {
  position: absolute;
  inset: 25%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  pointer-events: none;
}
.donut-label span,
.donut-label small {
  font-size: 11px;
  color: var(--text-secondary);
}
.donut-label strong {
  font-size: clamp(17px, 1.6vw, 23px);
  font-weight: 600;
  letter-spacing: -0.7px;
  font-variant-numeric: tabular-nums;
  max-width: 100%;
  overflow-wrap: anywhere;
  text-align: center;
}
.allocation-list {
  list-style: none;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
  margin: 0 -4px;
}
.allocation-list li + li {
  border-top: 1px solid var(--panel-border);
}
.allocation-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 12px 4px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-primary);
}
.allocation-item:hover,
.allocation-item.highlighted {
  background: var(--bg-dark);
}
.allocation-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.allocation-asset {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.allocation-amount {
  margin-left: 41px;
}
.allocation-asset small {
  font-size: 10px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.allocation-percent {
  margin-left: auto;
  font-size: 12px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.allocation-note {
  font-size: 12px;
  text-align: center;
  margin-bottom: 12px;
}
@media (max-width: 1200px) and (min-width: 651px) {
  .allocation-card {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    column-gap: 32px;
    align-items: center;
  }
  .allocation-card .panel-heading,
  .allocation-card > .empty-state,
  .allocation-note {
    grid-column: 1 / -1;
  }
  .allocation-donut {
    margin: 0;
  }
}
</style>
