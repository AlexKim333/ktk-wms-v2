<template>
  <div class="dash-container">
    <header class="dash-header">
      <h1>🏠 본사 대시보드</h1>
      <button class="btn-refresh" @click="loadAll" :disabled="isLoading">🔄 새로고침</button>
    </header>

    <div class="dash-grid">
      <!-- 1. 전사 오늘의 매출 -->
      <section class="dash-card">
        <h2>💰 오늘 전사 매출</h2>
        <div v-if="isLoading" class="dash-empty">불러오는 중...</div>
        <template v-else>
          <div class="dash-big-number">$ {{ formatPrice(companyTotals.total) }} MXN</div>
          <div class="dash-sub">거래 {{ companyTotals.count }}건 · {{ Object.keys(byBranch).length }}개 지점</div>
          <div class="dash-payment-breakdown">
            <div v-if="companyTotals.payments.Cash > 0" class="pay-row"><span>현금</span><span>$ {{ formatPrice(companyTotals.payments.Cash) }}</span></div>
            <div v-if="companyTotals.payments['Credit Card'] > 0" class="pay-row"><span>카드</span><span>$ {{ formatPrice(companyTotals.payments['Credit Card']) }}</span></div>
            <div v-if="companyTotals.payments['Wire Transfer'] > 0" class="pay-row"><span>이체</span><span>$ {{ formatPrice(companyTotals.payments['Wire Transfer']) }}</span></div>
            <div v-if="companyTotals.count === 0" class="dash-empty">오늘 아직 전사 판매 기록이 없습니다.</div>
          </div>
        </template>
      </section>

      <!-- 2. 지점 요청 현황 (전사) -->
      <section class="dash-card">
        <h2>📋 지점 요청 현황 (전사)</h2>
        <div v-if="isLoading" class="dash-empty">불러오는 중...</div>
        <template v-else>
          <div class="dash-req-row"><span>전체 등록 고객 수</span><span class="dash-req-num">{{ requestStatus.customerCount }}</span></div>
          <div class="dash-req-row"><span>상품 요청 - 승인 대기</span><span class="dash-req-num pending">{{ requestStatus.pendingCount }}</span></div>
          <div class="dash-req-row"><span>상품 요청 - 승인 완료</span><span class="dash-req-num approved">{{ requestStatus.approvedCount }}</span></div>
        </template>
      </section>

      <!-- 3. 지점별 매출 순위 -->
      <section class="dash-card dash-card-wide">
        <h2>🏆 지점별 오늘 매출 순위</h2>
        <div v-if="branchRanking.length === 0" class="dash-empty">오늘 지점별 판매 기록이 없습니다.</div>
        <table v-else class="dash-table">
          <thead><tr><th>지점</th><th>거래건수</th><th>매출액</th></tr></thead>
          <tbody>
            <tr v-for="row in branchRanking" :key="row.branch">
              <td>{{ row.branch }}</td>
              <td>{{ row.count }}</td>
              <td>$ {{ formatPrice(row.total) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 4. 지점별 시재 상태 -->
      <section class="dash-card dash-card-wide">
        <h2>🧾 지점별 시재 상태</h2>
        <div v-if="shiftStatusUnavailable" class="dash-empty">⚠️ 권한 문제로 시재 상태를 불러올 수 없습니다 (POS Opening Entry 조회 거부됨).</div>
        <table v-else class="dash-table">
          <thead><tr><th>지점</th><th>상태</th><th>담당자</th><th>개장 시각</th></tr></thead>
          <tbody>
            <tr v-for="row in shiftStatuses" :key="row.branch">
              <td>{{ row.branch }}</td>
              <td>
                <span v-if="row.open" class="dash-status-badge open" style="font-size:12px; padding:3px 10px;">🟢 개장중</span>
                <span v-else class="dash-status-badge closed" style="font-size:12px; padding:3px 10px;">🔴 마감</span>
              </td>
              <td>{{ row.user || '-' }}</td>
              <td>{{ row.openedAt || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 5. 재고 부족 경고 (전사) -->
      <section class="dash-card dash-card-wide">
        <h2>⚠️ 재고 부족 상품 (전사 상위 {{ lowStockItems.length }}개)</h2>
        <div v-if="lowStockItems.length === 0" class="dash-empty">재고 부족 상품이 없습니다.</div>
        <table v-else class="dash-table">
          <thead><tr><th>상품명</th><th>색상</th><th>전사 합계 재고</th></tr></thead>
          <tbody>
            <tr v-for="it in lowStockItems" :key="it.name">
              <td>{{ it.item_name }}</td>
              <td>{{ it.custom_color || '-' }}</td>
              <td class="dash-qty" :class="{ zero: it.qty <= 0 }">{{ it.qty }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 6. 최근 거래 (전사) -->
      <section class="dash-card dash-card-wide">
        <h2>🕒 오늘 최근 거래 (전사)</h2>
        <div v-if="recentSales.length === 0" class="dash-empty">오늘 거래 내역이 없습니다.</div>
        <table v-else class="dash-table">
          <thead><tr><th>시간</th><th>지점</th><th>고객</th><th>금액</th></tr></thead>
          <tbody>
            <tr v-for="inv in recentSales" :key="inv.name" :class="{ 'is-return': inv.is_return }">
              <td>{{ formatTime(inv.posting_time) }}</td>
              <td>{{ inv.branch }}</td>
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
import frappeApi from '../api/frappe.js'
import { formatPrice } from '../utils/formatPrice.js'
import { posProfileName } from '../utils/branchPosProfile.js'

const props = defineProps({
  branchList: { type: Array, default: () => [] }, // [{ name: 'CARMEN - K', ... }, ...]
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) }
})

const isLoading = ref(true)
const invoicesToday = ref([]) // [{ name, owner, customer, posting_time, grand_total, is_return, branch }]
const shiftStatuses = ref([])
const shiftStatusUnavailable = ref(false)
const requestStatus = ref({ customerCount: 0, pendingCount: 0, approvedCount: 0 })

const LOW_STOCK_THRESHOLD = 5

const companyTotals = computed(() => {
  const payments = { Cash: 0, 'Credit Card': 0, 'Wire Transfer': 0 }
  let total = 0
  invoicesToday.value.forEach((inv) => {
    total += Number(inv.grand_total || 0)
    ;(inv.paymentBreakdown || []).forEach((p) => {
      if (payments[p.mode_of_payment] !== undefined) payments[p.mode_of_payment] += Number(p.amount || 0)
    })
  })
  return { total, count: invoicesToday.value.length, payments }
})

const byBranch = computed(() => {
  const map = {}
  invoicesToday.value.forEach((inv) => {
    const b = inv.branch || '(미지정)'
    if (!map[b]) map[b] = { total: 0, count: 0 }
    map[b].total += Number(inv.grand_total || 0)
    map[b].count += 1
  })
  return map
})

const branchRanking = computed(() => {
  return Object.entries(byBranch.value)
    .map(([branch, v]) => ({ branch, ...v }))
    .sort((a, b) => b.total - a.total)
})

const recentSales = computed(() => {
  return [...invoicesToday.value].sort((a, b) => (b.posting_time || '').localeCompare(a.posting_time || '')).slice(0, 10)
})

// 전사 창고 합계 기준 재고 부족 상품 (이미 로드된 rawItems/binData 재사용, 별도 API 호출 없음)
const lowStockItems = computed(() => {
  const rows = props.rawItems.map((it) => {
    const warehouses = props.binData?.[it.name] || {}
    const qty = Object.values(warehouses).reduce((sum, v) => sum + Number(v || 0), 0)
    return { name: it.name, item_name: it.item_name, custom_color: it.custom_color, qty }
  }).filter((r) => r.qty <= LOW_STOCK_THRESHOLD)
  rows.sort((a, b) => a.qty - b.qty)
  return rows.slice(0, 15)
})

const formatTime = (t) => {
  if (!t) return '-'
  return String(t).split('.')[0].slice(0, 5)
}

const todayStr = () => new Date().toISOString().split('T')[0]

const loadInvoices = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Sales Invoice', {
      params: {
        fields: JSON.stringify(['name', 'owner', 'customer', 'posting_date', 'posting_time', 'grand_total', 'is_return']),
        filters: JSON.stringify([
          ['is_pos', '=', 1],
          ['docstatus', '=', 1],
          ['company', '=', 'kecon'],
          ['posting_date', '=', todayStr()]
        ]),
        limit_page_length: 0,
        order_by: 'posting_time desc'
      }
    })
    const invoices = res.data?.data || []
    if (invoices.length === 0) {
      invoicesToday.value = []
      return
    }

    // owner(이메일) -> 소속 지점(location) 매핑
    const owners = [...new Set(invoices.map((i) => i.owner))]
    const userRes = await frappeApi.get('/api/resource/User', {
      params: { fields: JSON.stringify(['name', 'location']), filters: JSON.stringify([['name', 'in', owners]]), limit_page_length: 0 }
    }).catch(() => ({ data: { data: [] } }))
    const ownerBranch = {}
    ;(userRes.data?.data || []).forEach((u) => { ownerBranch[u.name] = u.location })

    // 결제수단 분포는 상세 조회가 필요 (payments 자식테이블은 목록에 안 나옴)
    const detailDocs = await Promise.all(
      invoices.map((inv) => frappeApi.get(`/api/resource/Sales Invoice/${inv.name}`).catch(() => null))
    )
    invoicesToday.value = invoices.map((inv, idx) => ({
      ...inv,
      branch: ownerBranch[inv.owner] || '(미지정)',
      paymentBreakdown: detailDocs[idx]?.data?.data?.payments || []
    }))
  } catch (e) {
    console.error('Failed to load company-wide invoices:', e)
  }
}

const loadShiftStatuses = async () => {
  const branches = props.branchList.map((b) => b.name)
  if (branches.length === 0) {
    shiftStatuses.value = []
    return
  }
  const profileNames = branches.map((b) => posProfileName(b))
  try {
    // 주의: 이 목록 조회가 System Manager 권한으로도 403이 나는 경우가 확인됨(원인 미상 —
    // 단일 문서 조회는 될 걸로 추정, list query만 막힘). 조용히 빈 배열로 넘기지 않고
    // 실패를 그대로 던져서 "전부 마감"이라는 잘못된 정보를 보여주지 않도록 한다.
    const openingsRes = await frappeApi.get('/api/resource/POS Opening Entry', {
      params: {
        fields: JSON.stringify(['name', 'pos_profile', 'user', 'creation']),
        filters: JSON.stringify([['pos_profile', 'in', profileNames], ['docstatus', '=', 1]]),
        order_by: 'creation desc',
        limit_page_length: 0
      }
    })
    const openings = openingsRes.data?.data || []

    const closingsRes = await frappeApi.get('/api/resource/POS Closing Entry', {
      params: {
        fields: JSON.stringify(['pos_opening_entry']),
        filters: JSON.stringify([['pos_opening_entry', 'in', openings.map((o) => o.name)], ['docstatus', '=', 1]]),
        limit_page_length: 0
      }
    })
    const closedNames = new Set((closingsRes.data?.data || []).map((c) => c.pos_opening_entry))

    shiftStatusUnavailable.value = false
    shiftStatuses.value = branches.map((branch) => {
      const profile = posProfileName(branch)
      const latestOpen = openings.find((o) => o.pos_profile === profile && !closedNames.has(o.name))
      if (!latestOpen) return { branch, open: false, user: '', openedAt: '' }
      const openedAt = new Date(latestOpen.creation)
      return {
        branch,
        open: true,
        user: latestOpen.user,
        openedAt: openedAt.toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      }
    })
  } catch (e) {
    console.error('Failed to load shift statuses:', e)
    shiftStatusUnavailable.value = true
    shiftStatuses.value = []
  }
}

const loadRequestStatus = async () => {
  try {
    const [custRes, itemRes] = await Promise.all([
      frappeApi.get('/api/resource/Customer', { params: { fields: JSON.stringify(['name']), limit_page_length: 0 } }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Item', {
        params: { fields: JSON.stringify(['name', 'disabled', 'custom_pending_review']), filters: JSON.stringify([['description', 'like', '%[지점요청:%']]), limit_page_length: 0 }
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
  await Promise.all([loadInvoices(), loadShiftStatuses(), loadRequestStatus()])
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
