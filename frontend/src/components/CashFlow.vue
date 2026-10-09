<script setup>
import { ref, computed, onMounted } from 'vue';
import { monthLabel, dateLabel } from '../utils/format';
import { sortCashActivity, summarizeCashActivity } from '../utils/cashActivity';
const props = defineProps({ portfolio: { type: Object, required: true } });
const data = ref(null);
const error = ref('');
const loading = ref(false);
const unit = ref('USD');
const showBaht = ref(false);
const fx = ref(null);
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const response = await fetch('/api/cash-flow');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    data.value = payload;
    if (fx.value === null) fx.value = payload.growth.at(-1)?.usdThb ?? null;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
const validFx = computed(
  () => Number.isFinite(Number(fx.value)) && Number(fx.value) > 0,
);
const holdings = computed(() => props.portfolio.summary.totalCurrentValue);
const cash = computed(() => data.value?.currentCash?.cashUsd ?? null);
const total = computed(() =>
  cash.value === null ? null : holdings.value + cash.value,
);
const format = (value, currency = unit.value) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
        value,
      );
const currentMoney = (value) =>
  format(
    unit.value === 'THB'
      ? validFx.value && value !== null
        ? value * Number(fx.value)
        : null
      : value,
  );
const baht = (value) =>
  format(
    validFx.value && value !== null ? value * Number(fx.value) : null,
    'THB',
  );
const history = computed(() => data.value?.growth || []);
const values = computed(() =>
  history.value.map((p) => (unit.value === 'THB' ? p.valueThb : p.valueUsd)),
);
const activeMonth = ref(null);
const focusedMonth = computed(
  () =>
    history.value.find((p) => p.month === activeMonth.value) ||
    history.value.at(-1),
);
const maxValue = computed(() => Math.max(1, ...values.value));
const activityType = ref('All');
const activityYear = ref('All');
const activityYears = computed(() =>
  [...new Set((data.value?.statements || []).map((s) => s.month.slice(0, 4)))]
    .sort()
    .reverse(),
);
const activity = computed(() =>
  sortCashActivity(
    (data.value?.statements || [])
      .flatMap((s) => s.cashActivity || [])
      .filter(
        (a) =>
          (activityType.value === 'All' || a.type === activityType.value) &&
          (activityYear.value === 'All' ||
            a.date.startsWith(activityYear.value)),
      ),
  ),
);
const activitySummary = computed(() => summarizeCashActivity(activity.value));
const activityLabel = (type) =>
  ({ FX: 'แลกเงิน', DEPOSIT: 'ฝากเงิน', WITHDRAWAL: 'ถอนเงิน' })[type];
const activityDebit = (a) =>
  a.type === 'FX'
    ? format(a.fromAmount, a.fromCurrency)
    : a.type === 'WITHDRAWAL'
      ? format(a.amount, a.currency)
      : '—';
const activityCredit = (a) =>
  a.type === 'FX'
    ? format(a.toAmount, a.toCurrency)
    : a.type === 'DEPOSIT'
      ? format(a.amount, a.currency)
      : '—';
const exchangeRate = (a) => {
  if (a.type !== 'FX') return '—';
  const pair = [a.fromCurrency, a.toCurrency];
  if (pair.includes('USD') && pair.includes('THB'))
    return `1 USD = ${a.rate.toFixed(4)} THB`;
  return `1 ${a.fromCurrency} = ${(a.toAmount / a.fromAmount).toFixed(4)} ${a.toCurrency}`;
};
const cards = computed(() => [
  {
    label: 'มูลค่าพอร์ตปัจจุบัน',
    value: total.value,
    note: 'มูลค่าหุ้น + เงินสด USD',
  },
  {
    label: 'มูลค่าหุ้น',
    value: holdings.value,
    note: props.portfolio.summary.valuationIsEstimated
      ? 'มีราคาที่ประมาณด้วยต้นทุน'
      : 'ราคาตามการอัปเดตพอร์ตล่าสุด',
  },
  {
    label: 'เงินสด USD',
    value: cash.value,
    note: data.value?.currentCash
      ? data.value.currentCash.adjustedTransactions
        ? `ปรับตาม ${data.value.currentCash.adjustedTransactions} รายการใหม่ · ยอดตั้งต้น ${dateLabel(data.value.currentCash.asOf)}`
        : `ยอดที่แจ้ง ณ ${dateLabel(data.value.currentCash.asOf)}`
      : 'ยังไม่มีข้อมูลเงินสดปัจจุบัน',
  },
]);
</script>
<template>
  <section class="cash-flow">
    <div class="cash-toolbar">
      <div class="cash-controls">
        <label
          >Currency
          <select class="compact-select" v-model="unit">
            <option>USD</option>
            <option>THB</option>
          </select></label
        >
        <button
          v-if="unit === 'USD'"
          class="compact-button"
          :aria-pressed="showBaht"
          @click="showBaht = !showBaht"
        >
          {{ showBaht ? 'ซ่อนมูลค่าเทียบบาท' : 'แสดงมูลค่าเทียบบาท' }}
        </button>
      </div>
      <button class="compact-button" :disabled="loading" @click="load">
        {{ loading ? 'Loading…' : 'Reload statement data' }}
      </button>
    </div>
    <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
    <p v-if="loading && !data" class="muted">Loading portfolio history…</p>
    <template v-if="data">
      <div v-if="unit === 'THB' || showBaht" class="fx-control">
        <label
          >1 USD =
          <input
            class="form-control exchange-rate-input"
            v-model.number="fx"
            inputmode="decimal"
            type="number"
            min="0.01"
            step="0.01"
            aria-label="USD to THB exchange rate"
          />
          THB</label
        >
        <span class="muted"
          >ค่าเริ่มต้นจาก statement {{ dateLabel(history.at(-1)?.date) }} ·
          ปรับอัตราได้ · ไม่ใช่อัตราสด</span
        >
        <span v-if="!validFx" class="pl-negative"
          >กรุณาใส่อัตราที่มากกว่า 0</span
        >
      </div>
      <section
        class="grid-summary growth-cards"
        aria-label="Current portfolio value"
      >
        <div
          v-for="(card, i) in cards"
          :key="card.label"
          class="card summary-card"
          :class="{ primary: i === 0 }"
        >
          <span class="summary-label">{{ card.label }}</span
          ><strong class="summary-value">{{ currentMoney(card.value) }}</strong>
          <span v-if="unit === 'USD' && showBaht" class="baht-value"
            >≈ {{ baht(card.value) }}</span
          ><small class="muted">{{ card.note }}</small>
        </div>
      </section>
      <p class="muted current-note">
        ยอดปัจจุบันใช้ราคาหุ้นล่าสุดและเงินสดที่ปรับตามรายการที่บันทึก
        ส่วนประวัติย้อนหลังอัปเดตจาก statement
      </p>
      <section class="card growth-panel">
        <div class="cash-toolbar">
          <div>
            <h2>มูลค่าพอร์ตย้อนหลัง</h2>
            <p class="muted">หุ้นและเงินสดทั้งบัญชี ณ สิ้นเดือน</p>
          </div>
          <span class="muted"
            >{{ monthLabel(history[0]?.month) }} –
            {{ monthLabel(history.at(-1)?.month) }}</span
          >
        </div>
        <div class="monthly-bars" aria-label="Monthly portfolio values">
          <button
            v-for="(p, i) in history"
            :key="p.month"
            class="month-bar-button"
            :class="{ selected: focusedMonth?.month === p.month }"
            :aria-pressed="focusedMonth?.month === p.month"
            :aria-label="`${monthLabel(p.month)}: ${format(values[i])}`"
            @mouseenter="activeMonth = p.month"
            @focus="activeMonth = p.month"
            @click="activeMonth = p.month"
          >
            <span class="month-bar-track"
              ><span
                class="month-bar-fill"
                :style="{ height: `${(values[i] / maxValue) * 100}%` }"
              ></span
            ></span>
            <span class="month-bar-label">{{ monthLabel(p.month) }}</span>
          </button>
        </div>
        <div
          v-if="focusedMonth"
          class="month-detail"
          aria-live="polite"
          aria-atomic="true"
        >
          <div>
            <span class="muted"
              >{{ monthLabel(focusedMonth.month) }} · มูลค่าปิดเดือน</span
            ><strong>{{
              format(
                unit === 'THB' ? focusedMonth.valueThb : focusedMonth.valueUsd,
              )
            }}</strong
            ><small v-if="unit === 'USD' && showBaht"
              >≈ {{ format(focusedMonth.valueThb, 'THB') }}</small
            >
          </div>
          <div>
            <span class="muted">เติม / ถอนสุทธิ</span
            ><strong>{{
              format(
                unit === 'THB'
                  ? focusedMonth.fundingThb
                  : focusedMonth.fundingThb / focusedMonth.usdThb,
              )
            }}</strong>
          </div>
          <div>
            <span class="muted">เปลี่ยนแปลงหลังหักเงินเติม/ถอน</span
            ><strong
              :class="
                focusedMonth.growthThb >= 0 ? 'pl-positive' : 'pl-negative'
              "
              >{{
                format(
                  unit === 'THB'
                    ? focusedMonth.growthThb
                    : focusedMonth.growthThb / focusedMonth.usdThb,
                )
              }}</strong
            >
          </div>
        </div>
        <p class="muted chart-note">
          ชี้หรือกดแท่งเพื่อดูแต่ละเดือน · มูลค่ารวมมีผลจากเงินเติมและถอนด้วย
        </p>
      </section>
      <section class="card growth-panel">
        <h2>การเติบโตรายเดือน</h2>
        <p class="muted">
          แยกเงินเติม/ถอน เพื่อดูการเปลี่ยนแปลงมูลค่าที่ไม่ได้มาจากการเติมเงิน
        </p>
        <div class="growth-table-wrap">
          <table>
            <thead>
              <tr>
                <th>เดือน</th>
                <th>มูลค่าพอร์ต</th>
                <th>เติม / ถอนสุทธิ</th>
                <th>เปลี่ยนแปลงหลังหักเงินเติม/ถอน</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in history" :key="p.month">
                <td>{{ monthLabel(p.month) }}</td>
                <td>
                  {{ format(unit === 'THB' ? p.valueThb : p.valueUsd)
                  }}<small v-if="unit === 'USD' && showBaht"
                    >≈ {{ format(p.valueThb, 'THB') }}</small
                  >
                </td>
                <td>
                  {{
                    format(
                      unit === 'THB' ? p.fundingThb : p.fundingThb / p.usdThb,
                    )
                  }}<small v-if="unit === 'USD' && showBaht"
                    >≈ {{ format(p.fundingThb, 'THB') }}</small
                  >
                </td>
                <td :class="p.growthThb >= 0 ? 'pl-positive' : 'pl-negative'">
                  {{
                    format(
                      unit === 'THB' ? p.growthThb : p.growthThb / p.usdThb,
                    )
                  }}<small v-if="unit === 'USD' && showBaht"
                    >≈ {{ format(p.growthThb, 'THB') }}</small
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted chart-note">
          คำนวณจากมูลค่าปิด − มูลค่าเปิด − เงินเติม/ถอนสุทธิ
          รวมผลของอัตราแลกเปลี่ยนและค่าธรรมเนียม ยอด USD ย้อนหลังแปลงจาก THB
          ด้วยอัตราปิดเดือนของแต่ละ statement; อัตราด้านบนใช้เฉพาะยอดปัจจุบัน
        </p>
      </section>
      <section class="card growth-panel">
        <div class="cash-toolbar">
          <div>
            <h2>ประวัติแลกเงินและเงินเข้า/ออก</h2>
            <p class="muted">
              ใหม่อยู่บน เก่าอยู่ล่าง · วันเดียวกันเรียงถอน → แลก → ฝาก
              (รายการโอนไม่ระบุเวลา)
            </p>
          </div>
          <div class="cash-controls">
            <label
              >ประเภท
              <select class="compact-select" v-model="activityType">
                <option value="All">ทั้งหมด</option>
                <option value="FX">แลกเงิน</option>
                <option value="DEPOSIT">ฝากเงิน</option>
                <option value="WITHDRAWAL">ถอนเงิน</option>
              </select></label
            ><label
              >ปี
              <select class="compact-select" v-model="activityYear">
                <option value="All">ทุกปี</option>
                <option v-for="year in activityYears" :key="year" :value="year">
                  {{ year }}
                </option>
              </select></label
            >
          </div>
        </div>
        <div class="growth-table-wrap">
          <table>
            <thead>
              <tr>
                <th>วันที่ (ICT)</th>
                <th>ประเภท</th>
                <th>จ่ายออก</th>
                <th>รับเข้า</th>
                <th>อัตราแลกเงินจริง</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in activity" :key="a.id">
                <td>
                  {{ dateLabel(a.date)
                  }}<small v-if="a.time">{{ a.time }}</small>
                </td>
                <td>{{ activityLabel(a.type) }}</td>
                <td>{{ activityDebit(a) }}</td>
                <td>{{ activityCredit(a) }}</td>
                <td>{{ exchangeRate(a) }}</td>
              </tr>
              <tr v-if="!activity.length">
                <td colspan="5">ไม่มีรายการในช่วงที่เลือก</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          class="activity-totals"
          aria-label="Summary of filtered cash activity"
        >
          <div class="activity-total">
            <span class="summary-label">แลกเงิน</span
            ><span class="muted">{{ activitySummary.FX.count }} รายการ</span>
            <div
              v-for="d in activitySummary.FX.directions"
              :key="d.fromCurrency + d.toCurrency"
              class="fx-total-direction"
            >
              <span>{{ d.fromCurrency }} → {{ d.toCurrency }}</span
              ><strong
                >{{ format(d.fromAmount, d.fromCurrency) }} →
                {{ format(d.toAmount, d.toCurrency) }}</strong
              >
            </div>
            <span v-if="!activitySummary.FX.count" class="muted"
              >ไม่มีรายการ</span
            >
          </div>
          <div
            v-for="type in ['DEPOSIT', 'WITHDRAWAL']"
            :key="type"
            class="activity-total"
          >
            <span class="summary-label">{{ activityLabel(type) }}</span
            ><span class="muted">{{ activitySummary[type].count }} รายการ</span
            ><strong
              v-for="(amount, currency) in activitySummary[type].amounts"
              :key="currency"
              >{{ format(amount, currency) }}</strong
            ><span v-if="!activitySummary[type].count" class="muted"
              >ไม่มีรายการ</span
            >
          </div>
        </div>
        <p class="muted chart-note">
          สรุปตามตัวกรองประเภทและปีที่เลือก · แยกยอดแลกเงินแต่ละทิศทาง
          ไม่รวมกับยอดฝาก/ถอน
        </p>
        <p class="muted chart-note">
          {{ activity.length }} รายการ · ข้อมูลถึง
          {{ dateLabel(history.at(-1)?.date) }} ·
          แลกเงินเป็นการย้ายสกุลเงินในบัญชี
          ส่วนเงินเข้า/ถอนเป็นการโอนเข้า/ออกจากบัญชี จึงแสดงแยกกัน
        </p>
      </section>
    </template>
  </section>
</template>
<style scoped>
.cash-flow {
  font-size: 16px;
  line-height: 1.65;
  display: grid;
  gap: 20px;
}
.cash-toolbar,
.cash-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.cash-controls label,
.fx-control label {
  display: flex;
  align-items: center;
  gap: 10px;
}
.fx-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 14px;
}
.fx-control input {
  width: 116px;
  font-variant-numeric: tabular-nums;
}
.growth-cards {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.baht-value {
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.current-note {
  font-size: 14px;
}
.growth-panel {
  padding: 24px;
  min-width: 0;
}
h2 {
  font-size: 20px;
  margin-bottom: 8px;
}
.growth-panel p {
  font-size: 14px;
}
.monthly-bars {
  display: flex;
  align-items: stretch;
  gap: 8px;
  overflow-x: auto;
  padding: 24px 4px 12px;
}
.month-bar-button {
  flex: 1;
  min-width: 64px;
  background: transparent;
  color: var(--text-secondary);
  border: 0;
  padding: 4px;
  cursor: pointer;
}
.month-bar-button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
.month-bar-track {
  display: flex;
  align-items: flex-end;
  height: 180px;
  width: 100%;
  border-bottom: 1px solid var(--panel-border);
}
.month-bar-fill {
  display: block;
  width: 100%;
  background: var(--primary);
  opacity: 0.45;
  transition: opacity 160ms ease;
}
.month-bar-button.selected .month-bar-fill,
.month-bar-button:hover .month-bar-fill {
  opacity: 1;
}
.month-bar-label {
  display: block;
  font-size: 13px;
  padding-top: 10px;
  white-space: nowrap;
}
.month-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  border-top: 1px solid var(--panel-border);
  padding-top: 18px;
}
.month-detail > div {
  display: grid;
  gap: 6px;
}
.month-detail span,
.month-detail small {
  font-size: 14px;
}
.month-detail strong {
  font-size: 20px;
  font-variant-numeric: tabular-nums;
}
.chart-note {
  margin-top: 18px;
  line-height: 1.6;
}
.growth-table-wrap {
  overflow-x: auto;
  margin-top: 16px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 16px;
  white-space: nowrap;
}
th,
td {
  text-align: right;
  padding: 16px 12px;
  border-bottom: 1px solid var(--panel-border);
  font-variant-numeric: tabular-nums;
}
th:first-child,
td:first-child {
  text-align: left;
}
th {
  color: var(--text-secondary);
  font-weight: 500;
}
td small {
  display: block;
  margin-top: 4px;
  color: var(--text-muted);
}
.cash-flow .summary-label {
  font-size: 16px;
}
.cash-flow .summary-card small {
  font-size: 14px;
  line-height: 1.65;
}
.cash-flow .compact-button,
.cash-flow .compact-select,
.cash-flow .form-control {
  font-size: 16px;
  min-height: 44px;
}
.cash-flow .compact-select:focus-visible {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow);
}
.exchange-rate-input {
  appearance: textfield;
  -moz-appearance: textfield;
}
.exchange-rate-input::-webkit-inner-spin-button,
.exchange-rate-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.fx-control {
  padding: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
}
.cash-controls label {
  font-size: 16px;
}
.activity-totals {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.activity-total {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--bg-dark);
  min-width: 0;
}
.activity-total strong {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.activity-total .muted {
  font-size: 14px;
}
.fx-total-direction {
  display: grid;
  gap: 4px;
  padding-top: 8px;
}
.fx-total-direction > span {
  font-size: 14px;
  color: var(--text-secondary);
}
@media (max-width: 700px) {
  .activity-totals {
    grid-template-columns: 1fr;
  }
  .growth-cards {
    grid-template-columns: 1fr;
  }
  .growth-panel {
    padding: 16px;
  }
}
</style>
