<template>
  <div class="branch-detail-view">
    <header class="detail-header">
      <button class="btn-back" @click="$emit('go-back')">
        ← {{ t('btn_back', '돌아가기 (Atrás)') }}
      </button>
      <h2 class="title">
        📦 {{ item.item_name || item.item_code }} ({{ item.item_code }}) - 지점 전용 상세
      </h2>
      <div class="header-actions">
        <button class="btn-save" @click="handleSaveBranchPrice">
          💾 {{ t('btn_save_branch_price', '지점 단가 및 구간 저장 (Save)') }}
        </button>
      </div>
    </header>

    <!-- Notification Toast -->
    <transition name="fade">
      <div v-if="toastMsg" class="toast-popup">{{ toastMsg }}</div>
    </transition>

    <div class="detail-content">
      <!-- 1. 기본 정보 카드 -->
      <section class="card info-card">
        <div class="info-grid">
          <div class="info-item">
            <label>{{ t('category', '상품 카테고리 (Category)') }}</label>
            <div class="value">{{ item.item_group || '-' }}</div>
          </div>
          <div class="info-item">
            <label>{{ t('item_name', '상품명 (Item Name)') }}</label>
            <div class="value">{{ item.item_name || item.item_code }}</div>
          </div>
          <div class="info-item">
            <label>{{ t('uom', '재고 관리 단위 (UOM)') }}</label>
            <div class="value">{{ item.stock_uom || 'Nos' }}</div>
          </div>
          <div class="info-item">
            <label>{{ t('pack_qty', '박스당 수량 (Pack Qty)') }}</label>
            <div class="value pack-highlight">
              📦 {{ item.custom_pack_qty || item.pack_qty || 1 }} {{ item.stock_uom || 'Nos' }} / Box
            </div>
          </div>
        </div>
      </section>

      <!-- 2. 지점 및 알라르꼰(MAIN) 한정 재고 조회 -->
      <section class="card stock-card">
        <div class="section-header">
          <h3>🏢 지점별 재고 (Existencias)</h3>
          <span class="branch-badge">내 지점 & 알라르꼰(MAIN) 한정</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>지점 / 창고 (Ubicación)</th>
              <th>박스 재고 (Cajas)</th>
              <th>낱개 재고 (Unidades)</th>
              <th>총 재고 (Total)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bin in branchBinList" :key="bin.name">
              <td class="wh-name">{{ bin.warehouse }}</td>
              <td>{{ getBoxCount(bin.actual_qty) }} Box</td>
              <td>{{ getRemainderCount(bin.actual_qty) }} Pcs</td>
              <td class="total-qty">{{ bin.actual_qty }}</td>
            </tr>
            <tr v-if="branchBinList.length === 0">
              <td colspan="4" class="empty-cell">재고 정보가 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 3. 5단계 지점 단가표 및 스마트 수량구간 설정 (체크박스 제어) -->
      <section class="card price-card">
        <div class="section-header">
          <div class="title-with-checkbox">
            <h3>💰 지점별 5단계 단가표 (Precios de Venta)</h3>
            <label class="override-checkbox-label" title="체크하면 이 품목만의 고유 수량구간을 개별적으로 설정할 수 있습니다.">
              <input type="checkbox" v-model="useCustomTierOverride" @change="handleOverrideToggle" />
              <span class="checkbox-text">⚡ 개별 수량구간 설정 (Override Global Tiers)</span>
            </label>
          </div>
          <span class="branch-badge price-branch-badge">{{ currentBranch || '지점 POS' }}</span>
        </div>

        <!-- 알림/안내 바 -->
        <div class="engine-notice-bar" :class="{ override: useCustomTierOverride }">
          <span v-if="!useCustomTierOverride">
            💡 <strong>지점 전역 수량구간 + 스마트 BOX 수량(pack_qty={{ item.custom_pack_qty || 1 }})</strong>이 자동 연동 적용중입니다. (체크 시 개별 설정 가능)
          </span>
          <span v-else>
            🔧 <strong>품목 개별 수량구간 수동 설정중</strong>입니다. (수량 0 입력 시 해당 구간은 비활성화/예비 처리되어 3단계 등으로 작동합니다.)
          </span>
        </div>

        <table class="data-table price-table">
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
              <td class="tier-label">가격 1 (Precio 1)</td>
              <td>
                <input type="text" v-model="tierBarcodes[0]" placeholder="단품 바코드" class="input-text" />
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="tierQtys[0]"
                  :disabled="!useCustomTierOverride"
                  class="input-qty"
                  :class="{ readonly: !useCustomTierOverride }"
                />
              </td>
              <td>
                <input type="number" v-model.number="itemPrice.price_list_rate" placeholder="0" class="input-price" />
              </td>
            </tr>
            <!-- Tier 2 -->
            <tr>
              <td class="tier-label">가격 2 (Precio 2)</td>
              <td>
                <input type="text" v-model="tierBarcodes[1]" placeholder="소팩 바코드" class="input-text" />
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="tierQtys[1]"
                  :disabled="!useCustomTierOverride"
                  class="input-qty"
                  :class="{ readonly: !useCustomTierOverride }"
                />
              </td>
              <td>
                <input type="number" v-model.number="itemPrice.custom_tier_2_price" placeholder="0" class="input-price" />
              </td>
            </tr>
            <!-- Tier 3 -->
            <tr>
              <td class="tier-label">가격 3 (Precio 3)</td>
              <td>
                <input type="text" v-model="tierBarcodes[2]" placeholder="중팩 바코드" class="input-text" />
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="tierQtys[2]"
                  :disabled="!useCustomTierOverride"
                  class="input-qty"
                  :class="{ readonly: !useCustomTierOverride }"
                />
              </td>
              <td>
                <input type="number" v-model.number="itemPrice.custom_tier_3_price" placeholder="0" class="input-price" />
              </td>
            </tr>
            <!-- Tier 4 -->
            <tr>
              <td class="tier-label">가격 4 (Precio 4)</td>
              <td>
                <input type="text" v-model="tierBarcodes[3]" placeholder="대팩 바코드" class="input-text" />
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="tierQtys[3]"
                  :disabled="!useCustomTierOverride"
                  class="input-qty"
                  :class="{ readonly: !useCustomTierOverride }"
                />
              </td>
              <td>
                <input type="number" v-model.number="itemPrice.custom_tier_4_price" placeholder="0" class="input-price" />
              </td>
            </tr>
            <!-- Tier 5 (BOX) -->
            <tr class="tier-5-row">
              <td class="tier-label tier-5-label">가격 5 (Precio 5 - BOX)</td>
              <td>
                <input type="text" v-model="tierBarcodes[4]" placeholder="BOX 바코드" class="input-text" />
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="tierQtys[4]"
                  :disabled="!useCustomTierOverride"
                  class="input-qty tier-5-qty"
                  :class="{ readonly: !useCustomTierOverride }"
                />
              </td>
              <td>
                <input type="number" v-model.number="itemPrice.custom_tier_5_price" placeholder="0" class="input-price tier-5-price" />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 4. 최근 재고 이동 내역 (지점 & MAIN 한정) -->
      <section class="card ledger-card">
        <div class="section-header">
          <h3>📋 최근 지점 재고 이동 내역 (Stock Ledger)</h3>
        </div>
        <table class="data-table ledger-table">
          <thead>
            <tr>
              <th>일시 (Date)</th>
              <th>창고 (Warehouse)</th>
              <th>전표 (Voucher)</th>
              <th>수량 (Qty)</th>
              <th>최종 잔고 (After)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in ledgerList" :key="entry.name">
              <td>{{ entry.posting_date }} {{ entry.posting_time?.slice(0, 5) }}</td>
              <td>{{ entry.warehouse }}</td>
              <td>{{ entry.voucher_type }} ({{ entry.voucher_no }})</td>
              <td :class="entry.actual_qty > 0 ? 'qty-plus' : 'qty-minus'">
                {{ entry.actual_qty > 0 ? `+${entry.actual_qty}` : entry.actual_qty }}
              </td>
              <td class="qty-after">{{ entry.qty_after_transaction }}</td>
            </tr>
            <tr v-if="ledgerList.length === 0">
              <td colspan="5" class="empty-cell">재고 이동 내역이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import frappeApi from '../../api/frappe.js'
import {
  getBranchGlobalTiers,
  getBranchItemOverride,
  saveBranchItemOverride,
  resolveItemTiers
} from '../../composables/usePriceTierEngine.js'

const props = defineProps({
  itemId: {
    type: String,
    required: true
  },
  currentBranch: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['go-back'])
const { t } = useI18n()

const item = ref({})
const branchBinList = ref([])
const ledgerList = ref([])
const toastMsg = ref('')

// 5단계 단가표 상태
const useCustomTierOverride = ref(false)
const tierBarcodes = ref(['', '', '', '', ''])
const tierQtys = ref([1, 10, 50, 100, 200])
const itemPrice = ref({
  price_list_rate: 0,
  custom_tier_2_price: 0,
  custom_tier_3_price: 0,
  custom_tier_4_price: 0,
  custom_tier_5_price: 0
})

const showToast = (msg) => {
  toastMsg.value = msg
  setTimeout(() => {
    toastMsg.value = ''
  }, 3000)
}

const getBoxCount = (qty) => {
  const pack = Number(item.value.custom_pack_qty || item.value.pack_qty || 1)
  if (pack <= 0) return 0
  return Math.floor(Number(qty || 0) / pack)
}

const getRemainderCount = (qty) => {
  const pack = Number(item.value.custom_pack_qty || item.value.pack_qty || 1)
  if (pack <= 0) return Number(qty || 0)
  return Number(qty || 0) % pack
}

/**
 * 지점 전역 수량 + 스마트 BOX 수량 자동 로딩
 */
const loadDefaultTiersFromEngine = () => {
  const resolved = resolveItemTiers(props.currentBranch, item.value)
  if (Array.isArray(resolved) && resolved.length > 0) {
    for (let i = 0; i < 5; i++) {
      tierQtys.value[i] = resolved[i] ? Number(resolved[i].minQty || 0) : 0
    }
  } else {
    const defaultGlobal = getBranchGlobalTiers()
    tierQtys.value = defaultGlobal.map(g => Number(g.minQty || 0))
  }
}

/**
 * 체크박스 상태 전환 핸들러
 */
const handleOverrideToggle = () => {
  if (!useCustomTierOverride.value) {
    // 체크 해제 시 -> 전역 + 스마트 BOX 수량 로딩
    loadDefaultTiersFromEngine()
    showToast('💡 지점 전역 수량구간(스마트 BOX 연동) 모드로 전환되었습니다.')
  } else {
    showToast('🔧 품목 개별 수량구간(Override) 설정 모드로 전환되었습니다.')
  }
}

/**
 * 아이템 및 지점 재고/단가 데이터 불러오기
 */
const fetchDetailData = async () => {
  if (!props.itemId) return
  try {
    // 1. Item 마스터 가져오기
    const resItem = await frappeApi.get(`/api/resource/Item/${encodeURIComponent(props.itemId)}`)
    item.value = resItem.data.data

    // 바코드 세팅
    tierBarcodes.value[0] = item.value.custom_tier_1_barcode || ''
    tierBarcodes.value[1] = item.value.custom_tier_2_barcode || ''
    tierBarcodes.value[2] = item.value.custom_tier_3_barcode || ''
    tierBarcodes.value[3] = item.value.custom_tier_4_barcode || ''
    tierBarcodes.value[4] = item.value.custom_tier_5_barcode || ''

    // 개별 수량 Override 확인
    const savedOverride = getBranchItemOverride(props.currentBranch, props.itemId)
    if (savedOverride && savedOverride.useCustomOverride) {
      useCustomTierOverride.value = true
      tierQtys.value = savedOverride.tiers.map(t => Number(t.minQty || 0))
    } else {
      useCustomTierOverride.value = false
      loadDefaultTiersFromEngine()
    }

    // 2. 재고(Bin) 현황 (내 지점 및 MAIN 한정)
    const resBin = await frappeApi.get('/api/resource/Bin', {
      params: {
        filters: JSON.stringify([['item_code', '=', props.itemId]]),
        fields: JSON.stringify(['name', 'warehouse', 'actual_qty']),
        limit_page_length: 50
      }
    })
    const allBins = resBin.data.data || []
    branchBinList.value = allBins.filter(bin => {
      const wh = (bin.warehouse || '').toUpperCase()
      const branchUpper = (props.currentBranch || '').toUpperCase()
      return wh.includes('MAIN') || wh.includes('알라르꼰') || (branchUpper && wh.includes(branchUpper))
    })

    // 3. 지점별 Item Price 조회
    const targetPriceList = props.currentBranch ? `Standard Selling - ${props.currentBranch}` : 'Standard Selling'
    try {
      const resPrice = await frappeApi.get('/api/resource/Item Price', {
        params: {
          filters: JSON.stringify([
            ['item_code', '=', props.itemId],
            ['price_list', 'like', `%${props.currentBranch || 'Standard Selling'}%`]
          ]),
          fields: JSON.stringify([
            'name', 'price_list', 'price_list_rate',
            'custom_tier_2_price', 'custom_tier_3_price', 'custom_tier_4_price', 'custom_tier_5_price'
          ]),
          limit_page_length: 1
        }
      })
      if (resPrice.data.data && resPrice.data.data.length > 0) {
        const p = resPrice.data.data[0]
        itemPrice.value = {
          name: p.name,
          price_list: p.price_list,
          price_list_rate: Number(p.price_list_rate || 0),
          custom_tier_2_price: Number(p.custom_tier_2_price || 0),
          custom_tier_3_price: Number(p.custom_tier_3_price || 0),
          custom_tier_4_price: Number(p.custom_tier_4_price || 0),
          custom_tier_5_price: Number(p.custom_tier_5_price || 0)
        }
      } else {
        itemPrice.value = {
          price_list_rate: 0,
          custom_tier_2_price: 0,
          custom_tier_3_price: 0,
          custom_tier_4_price: 0,
          custom_tier_5_price: 0
        }
      }
    } catch (pe) {
      console.warn('Item Price load failed:', pe)
    }

    // 4. 재고 이동 원장 (Stock Ledger)
    try {
      const resLedger = await frappeApi.get('/api/resource/Stock Ledger Entry', {
        params: {
          filters: JSON.stringify([
            ['item_code', '=', props.itemId],
            ['is_cancelled', '=', 0]
          ]),
          fields: JSON.stringify([
            'name', 'posting_date', 'posting_time', 'warehouse',
            'voucher_type', 'voucher_no', 'actual_qty', 'qty_after_transaction'
          ]),
          order_by: 'posting_date desc, posting_time desc',
          limit_page_length: 15
        }
      })
      const allLedger = resLedger.data.data || []
      ledgerList.value = allLedger.filter(l => {
        const wh = (l.warehouse || '').toUpperCase()
        const branchUpper = (props.currentBranch || '').toUpperCase()
        return wh.includes('MAIN') || wh.includes('알라르꼰') || (branchUpper && wh.includes(branchUpper))
      })
    } catch (le) {
      console.warn('Stock ledger load failed:', le)
    }
  } catch (error) {
    console.error('BranchProductDetailView load error:', error)
  }
}

/**
 * 지점별 단가 및 수량구간 저장
 */
const handleSaveBranchPrice = async () => {
  try {
    // 1. 개별 수량구간 Override 저장
    saveBranchItemOverride(props.currentBranch, props.itemId, {
      useCustomOverride: useCustomTierOverride.value,
      tiers: [
        { minQty: Number(tierQtys.value[0] || 0), label: '가격 1 (Precio 1)' },
        { minQty: Number(tierQtys.value[1] || 0), label: '가격 2 (Precio 2)' },
        { minQty: Number(tierQtys.value[2] || 0), label: '가격 3 (Precio 3)' },
        { minQty: Number(tierQtys.value[3] || 0), label: '가격 4 (Precio 4)' },
        { minQty: Number(tierQtys.value[4] || 0), label: '가격 5 (Precio 5 - BOX)' }
      ]
    })

    // 1-1. Item 마스터에 1~5단계 바코드 저장
    try {
      await frappeApi.put(`/api/resource/Item/${encodeURIComponent(props.itemId)}`, {
        custom_tier_1_barcode: (tierBarcodes.value[0] || '').trim(),
        custom_tier_2_barcode: (tierBarcodes.value[1] || '').trim(),
        custom_tier_3_barcode: (tierBarcodes.value[2] || '').trim(),
        custom_tier_4_barcode: (tierBarcodes.value[3] || '').trim(),
        custom_tier_5_barcode: (tierBarcodes.value[4] || '').trim()
      })
    } catch (barcodeErr) {
      console.warn('Item barcode update warning (may require permissions):', barcodeErr)
    }

    // 2. 지점 Item Price 저장 또는 신규 생성
    if (itemPrice.value.name) {
      await frappeApi.put(`/api/resource/Item Price/${itemPrice.value.name}`, {
        price_list_rate: Number(itemPrice.value.price_list_rate || 0),
        custom_tier_2_price: Number(itemPrice.value.custom_tier_2_price || 0),
        custom_tier_3_price: Number(itemPrice.value.custom_tier_3_price || 0),
        custom_tier_4_price: Number(itemPrice.value.custom_tier_4_price || 0),
        custom_tier_5_price: Number(itemPrice.value.custom_tier_5_price || 0)
      })
    } else {
      // 신규 Item Price 생성
      const targetPriceList = props.currentBranch ? `Standard Selling - ${props.currentBranch}` : 'Standard Selling'
      const resCreated = await frappeApi.post('/api/resource/Item Price', {
        item_code: props.itemId,
        price_list: targetPriceList,
        price_list_rate: Number(itemPrice.value.price_list_rate || 0),
        custom_tier_2_price: Number(itemPrice.value.custom_tier_2_price || 0),
        custom_tier_3_price: Number(itemPrice.value.custom_tier_3_price || 0),
        custom_tier_4_price: Number(itemPrice.value.custom_tier_4_price || 0),
        custom_tier_5_price: Number(itemPrice.value.custom_tier_5_price || 0)
      })
      if (resCreated.data.data) {
        itemPrice.value.name = resCreated.data.data.name
      }
    }

    showToast('💾 지점별 단가 및 5단계 수량구간이 저장되었습니다.')
  } catch (error) {
    console.error('Save branch price error:', error)
    alert('❌ 저장 중 오류가 발생했습니다: ' + (error.message || '서버 오류'))
  }
}

onMounted(() => {
  fetchDetailData()
})

watch(() => props.itemId, () => {
  fetchDetailData()
})
</script>

<style scoped>
.branch-detail-view {
  padding: 24px 32px;
  background-color: #0f172a;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  color: #f8fafc;
  font-family: 'Inter', -apple-system, sans-serif;
}

.branch-detail-view::-webkit-scrollbar {
  width: 10px;
}
.branch-detail-view::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
.branch-detail-view::-webkit-scrollbar-thumb {
  background: #38bdf8;
  border-radius: 5px;
}
.branch-detail-view::-webkit-scrollbar-thumb:hover {
  background: #0284c7;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  border-bottom: 1px solid #334155;
  padding-bottom: 16px;
}

.btn-back {
  background-color: #1e293b;
  color: #e2e8f0;
  border: 1px solid #475569;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-back:hover {
  background-color: #334155;
  color: #ffffff;
}

.title {
  font-size: 22px;
  font-weight: 800;
  color: #38bdf8;
  margin: 0;
}

.btn-save {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  border: none;
  padding: 10px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
  transition: all 0.2s;
}

.btn-save:hover {
  transform: translateY(-1px);
  background: linear-gradient(135deg, #059669, #047857);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.card {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.2);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.info-item label {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}

.info-item .value {
  font-size: 16px;
  font-weight: 700;
  color: #ffffff;
}

.pack-highlight {
  color: #f59e0b !important;
  font-weight: 900 !important;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title-with-checkbox {
  display: flex;
  align-items: center;
  gap: 20px;
}

.title-with-checkbox h3 {
  margin: 0;
  font-size: 18px;
  color: #f1f5f9;
}

.override-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  background: rgba(56, 189, 248, 0.12);
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(56, 189, 248, 0.4);
  transition: all 0.2s;
}

.override-checkbox-label:hover {
  background: rgba(56, 189, 248, 0.22);
}

.override-checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #38bdf8;
}

.checkbox-text {
  font-size: 13px;
  font-weight: 700;
  color: #38bdf8;
}

.branch-badge {
  background-color: #0f172a;
  color: #38bdf8;
  border: 1px solid #38bdf8;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
}

.engine-notice-bar {
  background-color: rgba(59, 130, 246, 0.15);
  border-left: 4px solid #3b82f6;
  color: #cbd5e1;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 16px;
}

.engine-notice-bar.override {
  background-color: rgba(245, 158, 11, 0.15);
  border-left: 4px solid #f59e0b;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #334155;
  text-align: left;
  font-size: 14px;
}

.data-table th {
  background-color: #0f172a;
  color: #94a3b8;
  font-weight: 700;
}

.wh-name {
  font-weight: 700;
  color: #f8fafc;
}

.total-qty {
  font-weight: 800;
  color: #38bdf8;
}

.tier-label {
  font-weight: 700;
  color: #e2e8f0;
}

.tier-5-row {
  background-color: rgba(245, 158, 11, 0.08);
}

.tier-5-label {
  color: #f59e0b;
  font-weight: 900;
}

.input-text,
.input-qty,
.input-price {
  background-color: #0f172a;
  border: 1px solid #475569;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  width: 100%;
  box-sizing: border-box;
}

.input-qty.readonly {
  background-color: #1e293b;
  color: #94a3b8;
  border-color: #334155;
  cursor: not-allowed;
}

.tier-5-qty {
  border-color: #f59e0b;
  color: #fbbf24;
  font-weight: 800;
}

.tier-5-price {
  border-color: #f59e0b;
  font-weight: 800;
}

.qty-plus {
  color: #10b981;
  font-weight: 700;
}

.qty-minus {
  color: #ef4444;
  font-weight: 700;
}

.qty-after {
  font-weight: 800;
  color: #e2e8f0;
}

.empty-cell {
  text-align: center;
  color: #64748b;
  padding: 24px;
}

.toast-popup {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background-color: #10b981;
  color: #ffffff;
  padding: 14px 22px;
  border-radius: 8px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 10000;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
