<template>
  <div class="detail-container" v-if="item">
    <header class="detail-header">
      <button class="btn-back" @click="$emit('go-back')">
        ← 돌아가기 (Atrás)
      </button>
      <h2>Detalle del Producto ({{ item.item_code }})</h2>
      <div class="header-actions">
        <button v-if="isAdmin" class="btn-primary" @click="saveChanges">저장 (Save)</button>
      </div>
    </header>

    <div class="detail-content">
      <!-- 1. 기본 정보 -->
      <section class="card info-card">
        <div class="info-grid">
          <div>
            <label>상품 카테고리 (Category)</label>
            <div>{{ item.item_group }}</div>
          </div>
          <div>
            <label>상품명 (Item Name)</label>
            <div>{{ item.item_name }}</div>
          </div>
          <div>
            <label>재고 관리 단위 (UOM)</label>
            <div>{{ item.stock_uom }}</div>
          </div>
          <div>
            <label>박스당 수량 (Pack Qty)</label>
            <div class="font-bold text-teal">{{ item.custom_pack_qty || 1 }}</div>
          </div>
          <div v-if="isAdmin">
            <label>단종 처리 (Disabled)</label>
            <input type="checkbox" v-model="item.disabled" :true-value="1" :false-value="0" />
          </div>
        </div>
      </section>

      <!-- 2. 지점별 재고 (Existencias) -->
      <section class="card stock-card">
        <div class="section-header">
          <h3>지점별 재고 (Existencias)</h3>
          <!-- 필터 적용 알림 -->
          <span v-if="!isAdmin" class="branch-badge">내 지점 & 알라르꼰(MAIN) 한정</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>지점 (Ubicación)</th>
              <th>박스 재고 (Cajas)</th>
              <th>낱개 재고 (Unidades)</th>
              <th>총 재고 (Total)</th>
              <th>안전 재고 (Cantidad Minima)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bin in filteredBinList" :key="bin.name">
              <td>{{ bin.warehouse }}</td>
              <td class="align-right font-bold text-teal">{{ getBoxQty(bin.actual_qty) }} Box</td>
              <td class="align-right font-bold text-teal">{{ getEachQty(bin.actual_qty) }} Pcs</td>
              <td class="align-right font-bold">{{ bin.actual_qty }}</td>
              <td class="align-right">{{ bin.projected_qty }}</td>
            </tr>
            <tr v-if="filteredBinList.length === 0">
              <td colspan="5" class="text-center">재고 내역이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 3. 다단계 단가 (Precios de Venta) -->
      <section class="card price-card">
        <div class="section-header">
          <h3>지점별 단가표 (Precios de Venta)</h3>
          <!-- 시스템 관리자일 경우 다른 지점 단가 조회 가능 -->
          <select v-if="isAdmin" v-model="selectedPriceList" @change="fetchItemPrice">
            <option v-for="pl in priceLists" :key="pl" :value="pl">{{ pl }}</option>
          </select>
          <span v-else class="branch-badge">{{ userBranch }}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>구분 (Lista de Precios)</th>
              <th>스캔용 바코드 (Barcode)</th>
              <th>수량 (Qty)</th>
              <th>판매 가격 (Precio)</th>
            </tr>
          </thead>
          <tbody>
            <!-- Tier 1 -->
            <tr>
              <td>가격 1 (Precio 1)</td>
              <td><input type="text" v-model="item.custom_tier_1_barcode" :disabled="!isAdmin" /></td>
              <td><input type="number" v-model="item.custom_tier_1_qty" :disabled="!isAdmin" /></td>
              <td>
                <input type="number" v-model="itemPrice.price_list_rate" :disabled="!canEditPrice" />
              </td>
            </tr>
            <!-- Tier 2 -->
            <tr>
              <td>가격 2 (Precio 2)</td>
              <td><input type="text" v-model="item.custom_tier_2_barcode" :disabled="!isAdmin" /></td>
              <td><input type="number" v-model="item.custom_tier_2_qty" :disabled="!isAdmin" /></td>
              <td>
                <input type="number" v-model="itemPrice.custom_tier_2_price" :disabled="!canEditPrice" />
              </td>
            </tr>
            <!-- Tier 3 -->
            <tr>
              <td>가격 3 (Precio 3)</td>
              <td><input type="text" v-model="item.custom_tier_3_barcode" :disabled="!isAdmin" /></td>
              <td><input type="number" v-model="item.custom_tier_3_qty" :disabled="!isAdmin" /></td>
              <td>
                <input type="number" v-model="itemPrice.custom_tier_3_price" :disabled="!canEditPrice" />
              </td>
            </tr>
            <!-- Tier 4 -->
            <tr>
              <td>가격 4 (Precio 4)</td>
              <td><input type="text" v-model="item.custom_tier_4_barcode" :disabled="!isAdmin" /></td>
              <td><input type="number" v-model="item.custom_tier_4_qty" :disabled="!isAdmin" /></td>
              <td>
                <input type="number" v-model="itemPrice.custom_tier_4_price" :disabled="!canEditPrice" />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 4. 최근 물동량 원장 (Últimos Movimientos) -->
      <section class="card ledger-card">
        <div class="section-header">
          <h3>최근 물동량 (Últimos Movimientos)</h3>
          <!-- 시스템 관리자일 경우 전체 지점 조회 필터 가능, 아니면 자기 지점만 -->
          <select v-if="isAdmin" v-model="ledgerFilterBranch" @change="fetchLedger">
            <option value="All">전체 지점 조회 (All)</option>
            <option v-for="wh in allWarehouses" :key="wh" :value="wh">{{ wh }}</option>
          </select>
          <span v-else class="branch-badge">{{ userBranch }} 전용</span>
        </div>
        
        <div class="ledger-scroll-container">
          <table class="data-table ledger-table">
            <thead>
              <tr>
                <th>날짜 (Fecha)</th>
                <th>문서 (Movimiento)</th>
                <th>지점 (Ubicación)</th>
                <th>유형 (Tipo)</th>
                <th>수량 (Cantidad)</th>
                <th>출처 (Source)</th>
                <th>작업자 (Usuario)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sle in sleList" :key="sle.name">
                <td>{{ sle.posting_date }} {{ sle.posting_time }}</td>
                <td>
                  <a href="#" @click.prevent>{{ sle.voucher_type }} / {{ sle.voucher_no }}</a>
                </td>
                <td>{{ sle.warehouse }}</td>
                <td>
                  <span :class="['badge', sle.actual_qty > 0 ? 'in' : 'out']">
                    {{ sle.actual_qty > 0 ? '↑ Entrada' : '↓ Salida' }}
                  </span>
                </td>
                <td :class="sle.actual_qty > 0 ? 'text-green' : 'text-red'">
                  {{ sle.actual_qty > 0 ? '+' : '' }}{{ sle.actual_qty }}
                </td>
                <td>{{ getSleSource(sle) }}</td>
                <td>{{ sle.owner }}</td>
              </tr>
              <tr v-if="sleList.length === 0">
                <td colspan="7" class="text-center">이력이 없습니다.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="ledger-actions" v-if="hasMoreLedger">
          <button class="btn-secondary" @click="loadMoreLedger">전체 이력 더보기 (Ver Más)</button>
        </div>
      </section>
    </div>
  </div>
  <div v-else class="loading-container">
    <p>데이터를 불러오는 중입니다...</p>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth.js'
import { usePendingReservations } from '../composables/usePendingReservations.js'
import axios from 'axios'

const props = defineProps({
  itemId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['go-back'])

const authStore = useAuthStore()

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true 
})

// 상태 변수
const item = ref(null)
const binList = ref([])

const { fetchPendingReservations, getAvailableStock } = usePendingReservations()
const sleList = ref([])
const itemPrice = ref({
  name: null,
  price_list_rate: 0,
  custom_tier_2_price: 0,
  custom_tier_3_price: 0,
  custom_tier_4_price: 0
})

// 권한 처리
const userRole = computed(() => authStore.user?.access_level || 'Representative')
const userBranch = computed(() => authStore.user?.branch_name || 'Standard Selling')
const isAdmin = computed(() => ['Admin', 'Monitor'].includes(userRole.value))
const canEditPrice = computed(() => ['Admin', 'Manager'].includes(userRole.value))

const priceLists = ref(['Standard Selling'])
const selectedPriceList = ref(userBranch.value)
const allWarehouses = ref([])
const ledgerFilterBranch = ref('All')
const ledgerPage = ref(0)
const hasMoreLedger = ref(true)
const SLE_PAGE_SIZE = 20

// 지점별 재고 필터링 로직
const filteredBinList = computed(() => {
  if (isAdmin.value) return binList.value
  
  // 지점 유저는 자기 지점과 알라르꼰(MAIN)만 확인 가능
  return binList.value.filter(bin => {
    const wh = bin.warehouse.toUpperCase()
    return wh === userBranch.value.toUpperCase() || wh.includes('ALARCON')
  })
})

const getBoxQty = (totalQty) => {
  const pack = item.value?.custom_pack_qty || 1
  return Math.floor(totalQty / pack)
}

const getEachQty = (totalQty) => {
  const pack = item.value?.custom_pack_qty || 1
  return totalQty % pack
}

onMounted(async () => {
  if (!authStore.user) {
    router.push('/login')
    return
  }
  
  const itemId = props.itemId
  
  if (!isAdmin.value) {
    ledgerFilterBranch.value = userBranch.value
  }

  await loadData(itemId)
})

const loadData = async (itemId) => {
  try {
    // 1. Item 마스터 가져오기
    const resItem = await frappeApi.get(`/api/resource/Item/${encodeURIComponent(itemId)}`)
    item.value = resItem.data.data
    
    // 기본 수량이 없으면 1, 12, 100, 300 세팅
    if(!item.value.custom_tier_1_qty) item.value.custom_tier_1_qty = 1
    if(!item.value.custom_tier_2_qty) item.value.custom_tier_2_qty = 12
    if(!item.value.custom_tier_3_qty) item.value.custom_tier_3_qty = 100
    if(!item.value.custom_tier_4_qty) item.value.custom_tier_4_qty = 300

    // 2. 예약 현황(Material Request) 및 재고(Bin) 현황 가져오기
    await fetchPendingReservations()
    const resBin = await frappeApi.get('/api/resource/Bin', {
      params: {
        filters: JSON.stringify([['item_code', '=', itemId]]),
        fields: JSON.stringify(['name', 'warehouse', 'actual_qty', 'projected_qty']),
        limit_page_length: 50
      }
    })
    binList.value = resBin.data.data.map(bin => ({
      ...bin,
      actual_qty: getAvailableStock(itemId, bin.warehouse, Number(bin.actual_qty) || 0)
    }))
    
    allWarehouses.value = Array.from(new Set(binList.value.map(b => b.warehouse)))

    // 3. 단가표(Item Price) 가져오기
    if (isAdmin.value) {
      const resPL = await frappeApi.get('/api/resource/Price List', { params: { fields: JSON.stringify(['name']) } })
      priceLists.value = resPL.data.data.map(pl => pl.name)
    }
    await fetchItemPrice()

    // 4. 재고 원장(Stock Ledger Entry) 가져오기
    await fetchLedger(true)

  } catch (error) {
    console.error('Data load error:', error)
    alert('데이터를 불러오는데 실패했습니다.')
  }
}

const fetchLedger = async (reset = false) => {
  if (reset) {
    ledgerPage.value = 0
    sleList.value = []
    hasMoreLedger.value = true
  }
  if (!hasMoreLedger.value) return

  try {
    const filters = [
      ['item_code', '=', item.value.item_code],
      ['is_cancelled', '=', 0]
    ]

    // 관리자가 특정 지점을 골랐거나, 지점 유저여서 본인 지점만 필터링될 때
    if (ledgerFilterBranch.value !== 'All') {
      filters.push(['warehouse', '=', ledgerFilterBranch.value])
    }

    const resSle = await frappeApi.get('/api/resource/Stock Ledger Entry', {
      params: {
        filters: JSON.stringify(filters),
        fields: JSON.stringify(['name', 'posting_date', 'posting_time', 'voucher_type', 'voucher_no', 'actual_qty', 'warehouse', 'owner']),
        order_by: 'posting_date desc, posting_time desc',
        limit_start: ledgerPage.value * SLE_PAGE_SIZE,
        limit_page_length: SLE_PAGE_SIZE
      }
    })
    
    const slEntries = resSle.data.data
    if (slEntries.length < SLE_PAGE_SIZE) {
      hasMoreLedger.value = false
    }

    // 출처 확인용 맵핑
    const sleWithSource = await Promise.all(slEntries.map(async (sle) => {
      let source = sle.warehouse
      if (sle.voucher_type === 'Stock Entry') {
        try {
          const vRes = await frappeApi.get(`/api/resource/Stock Entry/${sle.voucher_no}`)
          const se = vRes.data.data
          if (se.purpose === 'Material Transfer') {
            const row = se.items.find(i => i.item_code === item.value.item_code)
            if (row && row.s_warehouse) {
              source = row.s_warehouse + ' -> ' + sle.warehouse
            }
          }
        } catch (e) {
          console.error(e)
        }
      }
      return { ...sle, _source_display: source }
    }))
    
    sleList.value = [...sleList.value, ...sleWithSource]
    ledgerPage.value++
  } catch(e) {
    console.error(e)
  }
}

const loadMoreLedger = () => {
  fetchLedger(false)
}

const fetchItemPrice = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Item Price', {
      params: {
        filters: JSON.stringify([
          ['item_code', '=', item.value.item_code],
          ['price_list', '=', selectedPriceList.value]
        ]),
        fields: JSON.stringify(['name', 'price_list_rate', 'custom_tier_2_price', 'custom_tier_3_price', 'custom_tier_4_price'])
      }
    })
    
    if (res.data.data.length > 0) {
      itemPrice.value = res.data.data[0]
    } else {
      // 없으면 신규 작성용 초기화
      itemPrice.value = {
        name: null,
        price_list_rate: 0,
        custom_tier_2_price: 0,
        custom_tier_3_price: 0,
        custom_tier_4_price: 0
      }
    }
  } catch(e) {
    console.error(e)
  }
}

const getSleSource = (sle) => {
  return sle._source_display || sle.warehouse
}

const saveChanges = async () => {
  if (!canEditPrice.value) {
    alert('권한이 없습니다.')
    return
  }

  try {
    // 1. Item 마스터 저장 (바코드, 수량은 글로벌)
    if (isAdmin.value) {
      await frappeApi.put(`/api/resource/Item/${item.value.item_code}`, {
        custom_tier_1_barcode: item.value.custom_tier_1_barcode,
        custom_tier_1_qty: item.value.custom_tier_1_qty,
        custom_tier_2_barcode: item.value.custom_tier_2_barcode,
        custom_tier_2_qty: item.value.custom_tier_2_qty,
        custom_tier_3_barcode: item.value.custom_tier_3_barcode,
        custom_tier_3_qty: item.value.custom_tier_3_qty,
        custom_tier_4_barcode: item.value.custom_tier_4_barcode,
        custom_tier_4_qty: item.value.custom_tier_4_qty,
        disabled: item.value.disabled
      })
    }

    // 2. 지점별 Item Price 저장
    const priceData = {
      item_code: item.value.item_code,
      price_list: selectedPriceList.value,
      price_list_rate: itemPrice.value.price_list_rate,
      custom_tier_2_price: itemPrice.value.custom_tier_2_price,
      custom_tier_3_price: itemPrice.value.custom_tier_3_price,
      custom_tier_4_price: itemPrice.value.custom_tier_4_price
    }

    if (itemPrice.value.name) {
      // Update
      await frappeApi.put(`/api/resource/Item Price/${itemPrice.value.name}`, priceData)
    } else {
      // Create
      await frappeApi.post('/api/resource/Item Price', priceData)
    }

    alert('저장되었습니다.')
    await loadData(item.value.item_code)

  } catch (error) {
    console.error('Save error:', error)
    alert('상품 저장 중 오류가 발생했습니다.\n\n' + error)
  }
}

watch(() => props.itemId, () => {
  loadData(props.itemId)
})
</script>

<style scoped>
.detail-container {
  padding: 20px;
  background: var(--theme-bg-gradient);
  min-height: 100vh;
  color: var(--text-primary);
  font-family: var(--sans);
}

.detail-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 15px;
}
.detail-header h2 {
  flex: 1;
  margin: 0;
}
.btn-back {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px 15px;
  cursor: pointer;
  font-size: 18px;
}
.btn-primary {
  background: var(--accent-green);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}
.section-header h3 { margin: 0; }
.branch-badge {
  background: rgba(0,255,204,0.1);
  color: var(--neon-teal);
  padding: 5px 10px;
  border-radius: 4px;
  font-weight: bold;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.info-grid label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: bold;
  display: block;
  margin-bottom: 5px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}
.data-table th, .data-table td {
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: left;
}
.data-table th {
  color: var(--text-secondary);
  font-size: 13px;
}

.data-table input {
  width: 100px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.2);
  color: white;
  padding: 5px;
  border-radius: 4px;
}
.data-table input:disabled {
  opacity: 0.5;
  background: transparent;
  border: none;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}
.badge.in { background: rgba(52, 211, 153, 0.2); color: #34d399; }
.badge.out { background: rgba(239, 68, 68, 0.2); color: #ef4444; }

.text-green { color: #34d399; font-weight: bold; }
.text-red { color: #ef4444; font-weight: bold; }
.text-center { text-align: center; color: var(--text-secondary); }

.ledger-scroll-container {
  max-height: 400px;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.ledger-table thead th {
  position: sticky;
  top: 0;
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  z-index: 1;
}

.ledger-actions {
  display: flex;
  justify-content: center;
  margin-top: 15px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  color: var(--text-secondary);
}
</style>
