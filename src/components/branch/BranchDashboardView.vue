<template>
  <div class="dash-container">
    <header class="dash-header">
      <h1>🏠 {{ currentBranch }} 대시보드</h1>
      <button class="btn-refresh" @click="loadAll" :disabled="isLoading">🔄 새로고침</button>
    </header>

    <div class="dash-grid">
      <!-- 1. 오늘의 매출 요약 -->
      <section class="dash-card">
        <h2>💰 오늘의 매출</h2>
        <div v-if="isLoading" class="dash-empty">불러오는 중...</div>
        <template v-else>
          <div class="dash-big-number">$ {{ formatPrice(todaySales.total) }} MXN</div>
          <div class="dash-sub">거래 {{ todaySales.count }}건</div>
          <div class="dash-payment-breakdown">
            <div v-if="todaySales.payments.Cash > 0" class="pay-row"><span>현금</span><span>$ {{ formatPrice(todaySales.payments.Cash) }}</span></div>
            <div v-if="todaySales.payments['Credit Card'] > 0" class="pay-row"><span>카드</span><span>$ {{ formatPrice(todaySales.payments['Credit Card']) }}</span></div>
            <div v-if="todaySales.payments['Wire Transfer'] > 0" class="pay-row"><span>이체</span><span>$ {{ formatPrice(todaySales.payments['Wire Transfer']) }}</span></div>
            <div v-if="todaySales.count === 0" class="dash-empty">오늘 아직 판매 기록이 없습니다.</div>
          </div>
        </template>
      </section>

      <!-- 2. 시재 상태 -->
      <section class="dash-card">
        <h2>🧾 시재 상태</h2>
        <div v-if="isLoading" class="dash-empty">불러오는 중...</div>
        <template v-else-if="shiftInfo.open">
          <div class="dash-status-badge open">🟢 개장중</div>
          <div class="dash-sub">개장 시각: {{ shiftInfo.openedAt }}</div>
          <div class="dash-sub">경과: {{ shiftInfo.elapsed }}</div>
        </template>
        <template v-else>
          <div class="dash-status-badge closed">🔴 마감 상태</div>
          <div class="dash-sub">POS 판매 화면에서 시재를 열어야 판매할 수 있습니다.</div>
        </template>
      </section>

      <!-- 3. 재고 부족 경고 -->
      <section class="dash-card dash-card-wide">
        <h2>⚠️ 재고 부족 상품 (상위 {{ lowStockItems.length }}개)</h2>
        <div v-if="lowStockItems.length === 0" class="dash-empty">재고 부족 상품이 없습니다.</div>
        <table v-else class="dash-table">
          <thead><tr><th>상품명</th><th>색상</th><th>남은 수량</th></tr></thead>
          <tbody>
            <tr v-for="it in lowStockItems" :key="it.name">
              <td>{{ it.item_name }}</td>
              <td>{{ it.custom_color || '-' }}</td>
              <td class="dash-qty" :class="{ zero: it.qty <= 0 }">{{ it.qty }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 4. 지점 요청 현황 -->
      <section class="dash-card">
        <h2>📋 지점 요청 현황</h2>
        <div v-if="isLoading" class="dash-empty">불러오는 중...</div>
        <template v-else>
          <div class="dash-req-row"><span>등록 고객 수</span><span class="dash-req-num">{{ requestStatus.customerCount }}</span></div>
          <div class="dash-req-row"><span>상품 요청 - 승인 대기</span><span class="dash-req-num pending">{{ requestStatus.pendingCount }}</span></div>
          <div class="dash-req-row"><span>상품 요청 - 승인 완료</span><span class="dash-req-num approved">{{ requestStatus.approvedCount }}</span></div>
        </template>
      </section>

      <!-- 5. 최근 거래 목록 -->
      <section class="dash-card dash-card-wide">
        <h2>🕒 오늘 최근 거래</h2>
        <div v-if="recentSales.length === 0" class="dash-empty">오늘 거래 내역이 없습니다.</div>
        <table v-else class="dash-table">
          <thead><tr><th>시간</th><th>고객</th><th>금액</th></tr></thead>
          <tbody>
            <tr v-for="inv in recentSales" :key="inv.name" :class="{ 'is-return': inv.is_return }">
              <td>{{ formatTime(inv.posting_time) }}</td>
              <td>{{ inv.customer }}</td>
              <td>{{ inv.is_return ? '-' : '' }}$ {{ formatPrice(Math.abs(inv.grand_total)) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import frappeApi from '../../api/frappe.js'
import { useAuthStore } from '../../stores/auth.js'
import { formatPrice } from '../../utils/formatPrice.js'
import { posProfileName } from '../../utils/branchPosProfile.js'
import { findOpenShiftEntry } from '../../utils/branchShift.js'

const props = defineProps({
  currentBranch: { type: String, default: '' },
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) }
})

const authStore = useAuthStore()

const isLoading = ref(true)
const todaySales = ref({ total: 0, count: 0, payments: { Cash: 0, 'Credit Card': 0, 'Wire Transfer': 0 } })
const recentSales = ref([])
const shiftInfo = ref({ open: false, openedAt: '', elapsed: '' })
const requestStatus = ref({ customerCount: 0, pendingCount: 0, approvedCount: 0 })

const LOW_STOCK_THRESHOLD = 5

// 이 지점 창고 기준 재고 부족 상품 — 이미 로드된 rawItems/binData를 그대로 활용(별도 API 호출 없음)
const lowStockItems = computed(() => {
  const branch = props.currentBranch
  if (!branch) return []
  const rows = props.rawItems.map((it) => {
    const qty = props.binData?.[it.name]?.[branch] || 0
    return { name: it.name, item_name: it.item_name, custom_color: it.custom_color, qty }
  }).filter((r) => r.qty <= LOW_STOCK_THRESHOLD)
  rows.sort((a, b) => a.qty - b.qty)
  return rows.slice(0, 10)
})

const formatTime = (t) => {
  if (!t) return '-'
  return String(t).split('.')[0].slice(0, 5)
}

const todayStr = () => new Date().toISOString().split('T')[0]

const loadTodaySales = async () => {
  const user = authStore.user?.member_name
  if (!user) return
  try {
    const res = await frappeApi.get('/api/resource/Sales Invoice', {
      params: {
        fields: JSON.stringify(['name', 'customer', 'posting_date', 'posting_time', 'grand_total', 'is_return']),
        filters: JSON.stringify([
          ['is_pos', '=', 1],
          ['docstatus', '=', 1],
          ['company', '=', 'kecon'],
          ['owner', '=', user],
          ['posting_date', '=', todayStr()]
        ]),
        limit_page_length: 200,
        order_by: 'posting_time desc'
      }
    })
    const invoices = res.data?.data || []
    recentSales.value = invoices.slice(0, 10)

    let total = 0
    const payments = { Cash: 0, 'Credit Card': 0, 'Wire Transfer': 0 }
    const detailDocs = await Promise.all(
      invoices.map((inv) => frappeApi.get(`/api/resource/Sales Invoice/${inv.name}`).catch(() => null))
    )
    detailDocs.forEach((r) => {
      const doc = r?.data?.data
      if (!doc) return
      total += Number(doc.grand_total || 0)
      ;(doc.payments || []).forEach((p) => {
        if (payments[p.mode_of_payment] !== undefined) payments[p.mode_of_payment] += Number(p.amount || 0)
      })
    })
    todaySales.value = { total, count: invoices.length, payments }
  } catch (e) {
    console.error('Failed to load today sales:', e)
  }
}

const loadShiftInfo = async () => {
  const user = authStore.user?.member_name
  const branch = props.currentBranch
  if (!user || !branch) return
  try {
    const opening = await findOpenShiftEntry(frappeApi, { user, posProfile: posProfileName(branch) })
    if (!opening) {
      shiftInfo.value = { open: false, openedAt: '', elapsed: '' }
      return
    }
    const openedAt = new Date(opening.creation)
    const diffMs = Date.now() - openedAt.getTime()
    const hours = Math.floor(diffMs / 3600000)
    const minutes = Math.floor((diffMs % 3600000) / 60000)
    shiftInfo.value = {
      open: true,
      openedAt: openedAt.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      elapsed: `${hours}시간 ${minutes}분`
    }
  } catch (e) {
    console.error('Failed to load shift info:', e)
  }
}

const loadRequestStatus = async () => {
  const branch = props.currentBranch
  if (!branch) return
  try {
    const [custRes, itemRes] = await Promise.all([
      frappeApi.get('/api/resource/Customer', {
        params: { fields: JSON.stringify(['name']), filters: JSON.stringify([['custom_managing_branch', '=', branch]]), limit_page_length: 0 }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Item', {
        params: {
          fields: JSON.stringify(['name', 'disabled', 'custom_pending_review']),
          filters: JSON.stringify([['description', 'like', `%[지점요청:${branch}]%`]]),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } }))
    ])
    const items = itemRes.data?.data || []
    requestStatus.value = {
      customerCount: (custRes.data?.data || []).length,
      pendingCount: items.filter((i) => i.custom_pending_review).length,
      approvedCount: items.filter((i) => !i.custom_pending_review && !i.disabled).length
    }
  } catch (e) {
    console.error('Failed to load request status:', e)
  }
}

const loadAll = async () => {
  isLoading.value = true
  await Promise.all([loadTodaySales(), loadShiftInfo(), loadRequestStatus()])
  isLoading.value = false
}

onMounted(loadAll)
</script>

<style scoped>
.dash-container { padding: 20px 24px 32px; background: #f4f6f9; height: 100%; overflow-y: auto; box-sizing: border-box; }
.dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.dash-header h1 { margin: 0; font-size: 20px; color: #1e293b; }
.btn-refresh { background: none; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #475569; font-weight: bold; }
.dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.dash-card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.dash-card-wide { grid-column: 1 / -1; }
.dash-card h2 { margin: 0 0 12px; font-size: 15px; color: #334155; }
.dash-big-number { font-size: 28px; font-weight: 800; color: #0f172a; }
.dash-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
.dash-empty { padding: 16px 0; text-align: center; color: #94a3b8; font-size: 13px; }
.dash-payment-breakdown { margin-top: 12px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
.pay-row { display: flex; justify-content: space-between; font-size: 13px; color: #475569; padding: 3px 0; }
.dash-status-badge { display: inline-flex; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; }
.dash-status-badge.open { background: #dcfce7; color: #15803d; }
.dash-status-badge.closed { background: #fee2e2; color: #b91c1c; }
.dash-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dash-table th { text-align: left; padding: 8px 10px; background: #f8fafc; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
.dash-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.dash-table tr.is-return td { color: #dc2626; }
.dash-qty.zero { color: #dc2626; font-weight: 700; }
.dash-req-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #475569; }
.dash-req-row:last-child { border-bottom: none; }
.dash-req-num { font-weight: 700; font-size: 15px; color: #0f172a; }
.dash-req-num.pending { color: #b45309; }
.dash-req-num.approved { color: #047857; }
@media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } }
</style>
