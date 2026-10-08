<script setup>
import { ref, computed } from 'vue';
import { currency, percent, shares, dateLabel, monthLabel } from '../utils/format';
const props = defineProps({ profitHistory: { type: Array, required: true }, dividendHistory: { type: Array, default: () => [] }, summary: { type: Object, required: true } });
const month = ref('All');
const search = ref('');
const sortBy = ref('lastTransactionDate');
const descending = ref(true);
const months = computed(() => [...new Set([...props.profitHistory.map(event => event.lastTransactionDate.slice(0, 7)), ...props.dividendHistory.map(event => event.date.slice(0, 7))])].sort().reverse());
const matches = (symbol, date) => (!search.value.trim() || symbol.includes(search.value.trim().toUpperCase())) && (month.value === 'All' || date.startsWith(month.value));
const sales = computed(() => props.profitHistory.filter(event => matches(event.symbol, event.lastTransactionDate)));
const dividends = computed(() => props.dividendHistory.filter(event => matches(event.symbol, event.date)));
const realized = computed(() => month.value === 'All' && !search.value.trim() ? props.summary.totalRealizedPL : sales.value.reduce((sum, event) => sum + event.realizedPL, 0));
const dividendIncome = computed(() => month.value === 'All' && !search.value.trim() ? props.summary.totalDividendIncome || 0 : dividends.value.reduce((sum, event) => sum + event.amount, 0));
const wins = computed(() => sales.value.filter(event => event.realizedPL > 0).length);
const winRate = computed(() => sales.value.length ? wins.value / sales.value.length * 100 : 0);
const inferred = computed(() => dividends.value.some(event => event.inferred));
const jepqPL = computed(() => sales.value.filter(event => event.symbol === 'JEPQ').reduce((sum, event) => sum + event.realizedPL, 0));
const ranked = computed(() => {
  const groups = {};
  for (const event of sales.value) groups[event.symbol] = (groups[event.symbol] || 0) + event.realizedPL;
  return Object.entries(groups).sort((a, b) => b[1] - a[1]);
});
const rows = computed(() => [...sales.value].sort((a, b) => {
  const comparison = typeof a[sortBy.value] === 'string' ? a[sortBy.value].localeCompare(b[sortBy.value]) : a[sortBy.value] - b[sortBy.value];
  return descending.value ? -comparison : comparison;
}));
function sort(key) { descending.value = sortBy.value === key ? !descending.value : true; sortBy.value = key; }
const columns = [{key:'symbol',label:'Asset'},{key:'sharesSold',label:'Shares sold'},{key:'avgBuyPrice',label:'Avg cost'},{key:'avgSellPrice',label:'Sell price'},{key:'totalInvested',label:'Cost basis'},{key:'totalProceeds',label:'Net proceeds'},{key:'totalFees',label:'Sell fees'},{key:'realizedPL',label:'Realized P/L'},{key:'lastTransactionDate',label:'Sale date'}];
const trend = computed(() => {
  const events = [...sales.value].sort((a, b) => a.lastTransactionDate.localeCompare(b.lastTransactionDate));
  if (!events.length) return null;
  const start = Date.parse(events[0].lastTransactionDate) - 86400000;
  const end = Date.parse(events.at(-1).lastTransactionDate);
  let cumulative = 0;
  const values = [{ date: start, amount: 0 }, ...events.map(event => ({date: Date.parse(event.lastTransactionDate), amount: cumulative += event.realizedPL}))];
  const min = Math.min(0, ...values.map(event => event.amount));
  const max = Math.max(0, ...values.map(event => event.amount));
  const range = max - min || 1;
  const points = values.map(event => ({...event, x: 35 + (event.date - start) / Math.max(1, end - start) * 530, y: 145 - (event.amount - min) / range * 115}));
  return { points, path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '), baseline: 145 - (0 - min) / range * 115, min, max, first: events[0].lastTransactionDate, last: events.at(-1).lastTransactionDate };
});
</script>
<template>
  <div class="profit-history-container">
    <div class="panel-heading returns-filters"><div><h2>Realized returns</h2><p class="muted">{{ monthLabel(month) }} · {{ sales.length }} sales · amounts after recorded transaction fees</p></div><div class="filters-row"><input v-model="search" class="form-control search-input" placeholder="Search asset…" aria-label="Search return history by asset" /><select v-model="month" class="compact-select" aria-label="Returns period"><option value="All">All time</option><option v-for="key in months" :key="key" :value="key">{{ monthLabel(key) }}</option></select></div></div>
    <section class="grid-summary metrics-four">
      <div class="card summary-card"><span class="summary-label">Realized sale P/L</span><strong class="summary-value" :class="realized >= 0 ? 'pl-positive' : 'pl-negative'">{{ currency(realized) }}</strong><small class="muted">All asset sales, including JEPQ</small></div>
      <div class="card summary-card"><span class="summary-label">Reinvested dividends</span><strong class="summary-value">{{ currency(dividendIncome) }}</strong><small class="muted">{{ inferred ? 'Estimated from legacy imports' : 'Explicitly recorded reinvestments' }}</small></div>
      <div class="card summary-card"><span class="summary-label">Recorded realized income</span><strong class="summary-value" :class="realized + dividendIncome >= 0 ? 'pl-positive' : 'pl-negative'">{{ currency(realized + dividendIncome) }}</strong><small class="muted">Sale P/L + reinvested dividends{{ inferred ? ' · estimated' : '' }}</small></div>
      <div class="card summary-card"><span class="summary-label">Profitable sales</span><strong class="summary-value">{{ sales.length ? winRate.toFixed(1) + '%' : '—' }}</strong><small class="muted">{{ wins }} profitable / {{ sales.length }} sales</small></div>
    </section>
    <details class="card income-explanation">
      <summary>วิธีคำนวณกำไรจากการขายและปันผล <span v-if="inferred" class="muted">· มีรายการปันผลเก่าที่เป็นค่าประมาณ</span></summary>
      <p>กำไรจากการขาย = เงินขายหลังค่าธรรมเนียม − ต้นทุนเฉลี่ยของหน่วยที่ขาย รวมการขายกองทุนและเศษหน่วย JEPQ ({{ currency(jepqPL) }} ในช่วงนี้) ส่วนปันผลซื้อซ้ำเพิ่มต้นทุนของหน่วยใหม่ เมื่อขายจะนับเฉพาะกำไร/ขาดทุนเหนือจากต้นทุนนั้น จึงไม่หักปันผลออกจากกำไรการขายและไม่นับซ้ำ</p>
      <p v-if="inferred" class="estimate-note">รายการเก่ายังไม่มีประเภทปันผล: ประมาณจากรายการนำเข้า JEPQ ที่ซื้อไม่ถึง 1 หน่วยและค่าธรรมเนียมเป็น 0 ตรวจรายละเอียดด้านล่างได้ เงินปันผลที่รับเป็นเงินสดและไม่ได้บันทึกยังไม่รวมในยอดนี้</p>
      <p v-else class="muted">รวมเฉพาะปันผลซื้อซ้ำที่บันทึกไว้ ไม่รวมเงินปันผลรับเป็นเงินสดที่ไม่ได้บันทึก</p>
    </details>
    <div v-if="trend" class="card trend-card">
      <div class="panel-heading"><div><h2>Cumulative sale P/L</h2><p class="muted">เฉพาะกำไรจากการขายในช่วงและสินทรัพย์ที่เลือก · ไม่รวมปันผล</p></div><strong :class="realized >= 0 ? 'pl-positive' : 'pl-negative'">{{ currency(realized) }}</strong></div>
      <svg viewBox="0 0 600 170" role="img" aria-label="Cumulative realized sale profit chart" class="profit-trend"><line x1="35" x2="565" :y1="trend.baseline" :y2="trend.baseline" stroke="#94a3b8" stroke-dasharray="4 4" opacity=".4"/><path :d="trend.path" fill="none" :stroke="realized >= 0 ? 'var(--success)' : 'var(--danger)'" stroke-width="3"/><circle v-for="(point, index) in trend.points" :key="index" :cx="point.x" :cy="point.y" r="3" fill="var(--primary)"><title>{{ new Date(point.date).toLocaleDateString('en-GB') }}: {{ currency(point.amount) }}</title></circle><text x="35" y="18" fill="var(--text-secondary)" font-size="11">{{ currency(trend.max) }}</text><text x="35" y="165" fill="var(--text-secondary)" font-size="11">{{ currency(trend.min) }}</text></svg>
      <div class="trend-axis"><span>{{ dateLabel(trend.first) }}</span><span>{{ dateLabel(trend.last) }}</span></div>
      <p v-if="ranked.length" class="muted">Highest total by asset: <strong>{{ ranked[0][0] }} {{ currency(ranked[0][1]) }}</strong> · Lowest total by asset: <strong>{{ ranked.at(-1)[0] }} {{ currency(ranked.at(-1)[1]) }}</strong></p>
    </div>
    <div class="card">
      <div class="panel-heading"><div><h2>Sale history</h2><p class="muted">Average cost includes buy fees · net proceeds deduct sell fees</p></div></div>
      <div v-if="!rows.length" class="empty-state">No sales match this period or asset.</div>
      <div v-else class="table-container ledger-table"><table><thead><tr><th v-for="column in columns" :key="column.key" :class="{'text-right': !['symbol','lastTransactionDate'].includes(column.key)}" :aria-sort="sortBy === column.key ? (descending ? 'descending' : 'ascending') : 'none'"><button class="sort-button" @click="sort(column.key)">{{ column.label }} <span v-if="sortBy === column.key">{{ descending ? '↓' : '↑' }}</span></button></th></tr></thead><tbody><tr v-for="event in rows" :key="event.id"><td><span class="stock-symbol-badge">{{ event.symbol }}</span></td><td class="text-right">{{ shares(event.sharesSold) }}</td><td class="text-right">{{ currency(event.avgBuyPrice) }}</td><td class="text-right">{{ currency(event.avgSellPrice) }}</td><td class="text-right">{{ currency(event.totalInvested) }}</td><td class="text-right">{{ currency(event.totalProceeds) }}</td><td class="text-right">{{ currency(event.totalFees) }}</td><td class="text-right" :class="event.realizedPL >= 0 ? 'pl-positive' : 'pl-negative'">{{ currency(event.realizedPL) }}<small class="table-subline" style="color:inherit">{{ percent(event.realizedPLPercent) }}</small></td><td>{{ dateLabel(event.lastTransactionDate) }}</td></tr></tbody></table></div>
    </div>
    <details class="card dividend-details"><summary>Dividend reinvestment records · {{ dividends.length }} entries · {{ currency(dividendIncome) }}</summary><p class="muted">มูลค่าที่นำไปลงทุนซ้ำ (รวมค่าธรรมเนียมที่บันทึกไว้) ไม่ใช่ยอดปันผลก่อนหักภาษี</p><div v-if="!dividends.length" class="empty-state">No recorded reinvestments in this period.</div><div v-else class="table-container"><table><thead><tr><th>Date</th><th>Asset</th><th class="text-right">Shares</th><th class="text-right">Reinvested amount</th><th>Source</th></tr></thead><tbody><tr v-for="event in dividends" :key="event.id"><td>{{ dateLabel(event.date) }}</td><td>{{ event.symbol }}</td><td class="text-right">{{ shares(event.shares) }}</td><td class="text-right">{{ currency(event.amount) }}</td><td>{{ event.inferred ? 'Estimated legacy import' : 'Recorded dividend reinvestment' }}</td></tr></tbody></table></div></details>
  </div>
</template>
<style scoped>
.profit-history-container > .card { margin-bottom:1rem; }
.filters-row { display:flex; gap:.75rem; flex-wrap:wrap; }
.search-input { max-width:200px; padding:.5rem .75rem; }
.income-explanation summary { cursor:pointer; font-size:.85rem; font-weight:600; }
.income-explanation p { font-size:.85rem; color:var(--text-secondary); margin:.5rem 0 0; line-height:1.7; }
.income-explanation .estimate-note { color:var(--warning); }
.profit-trend { width:100%; max-height:210px; display:block; }
.trend-axis { display:flex; justify-content:space-between; font-size:.75rem; color:var(--text-secondary); margin:.3rem 0 .7rem; }
.dividend-details summary { cursor:pointer; font-weight:600; }
</style>
