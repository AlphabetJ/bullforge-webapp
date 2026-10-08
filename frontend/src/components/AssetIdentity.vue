<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({ symbol: { type: String, required: true } });
const failed = ref(false);
const loaded = ref(false);
const ticker = computed(() => props.symbol.trim().toUpperCase());
const logoUrl = computed(() =>
  /^[A-Z0-9.^=-]{1,20}$/.test(ticker.value)
    ? `https://img.anylogo.dev/ticker/${encodeURIComponent(ticker.value)}?size=64&variant=icon&fallback=404`
    : null,
);
watch(ticker, () => {
  failed.value = false;
  loaded.value = false;
});
</script>

<template>
  <span class="asset-identity">
    <span
      class="asset-logo"
      :class="{ 'has-logo': loaded && !failed }"
      aria-hidden="true"
    >
      <span v-if="!loaded || failed" class="asset-initials">{{
        ticker.slice(0, 2)
      }}</span>
      <img
        v-if="logoUrl && !failed"
        :key="ticker"
        :src="logoUrl"
        alt=""
        width="28"
        height="28"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        :class="{ loaded }"
        @load="loaded = true"
        @error="
          failed = true;
          loaded = false;
        "
      />
    </span>
    <span class="asset-symbol">{{ ticker }}</span>
  </span>
</template>

<style scoped>
.asset-identity {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  vertical-align: middle;
}
.asset-logo {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: var(--primary-glow);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  overflow: hidden;
}
.asset-logo.has-logo {
  background: #ffffff;
}
.asset-logo img {
  position: absolute;
  width: 24px;
  height: 24px;
  object-fit: contain;
  opacity: 0;
}
.asset-logo img.loaded {
  opacity: 1;
}
.asset-initials {
  font-size: 10px;
  font-weight: 600;
  color: var(--primary);
}
.asset-symbol {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}
</style>
