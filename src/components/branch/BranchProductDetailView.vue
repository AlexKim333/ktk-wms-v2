<template>
  <div class="branch-detail-view">
    <header class="detail-header">
      <button class="btn-back" @click="$emit('go-back')">
        ← {{ t('branch.detail.btn_back') }}
      </button>
      <h2 class="title">
        📦 {{ item.item_name || item.item_code }} ({{ item.item_code }}) - 지점 전용 상세
      </h2>
      <div class="header-actions">
        <button class="btn-save" :disabled="isSaving" @click="handleSaveBranchPrice">
          <template v-if="isSaving">
            ⏳ 저장 중…<span v-if="saveTotal > 1"> ({{ saveDone }}/{{ saveTotal }})</span>
          </template>
          <template v-else>💾 {{ t('branch.detail.btn_save_branch_price') }}</template>
        </button>
      </div>
    </header>

    <!-- 패밀리 일괄 전파는 품목당 순차 요청이라 수 초가 걸린다. 멈춘 것으로 오해하지 않도록 진행률을 보여준다. -->
    <div v-if="isSaving && saveTotal > 1" class="save-progress">
      <div class="save-progress-bar" :style="{ width: savePercent + '%' }"></div>
      <span class="save-progress-text">
        패밀리 변형 단가 전파 중… {{ saveDone }} / {{ saveTotal }} ({{ savePercent }}%)
      </span>
    </div>

    <!-- Notification Toast -->
    <transition name="fade">
      <div v-if="toastMsg" class="toast-popup">{{ toastMsg }}</div>
    </transition>

    <div class="detail-content">
      <!-- 1. 기본 정보 카드 -->
      <section class="card info-card">
        <div class="info-grid">
          <div class="info-item">
            <label>{{ t('branch.detail.category') }}</label>
            <div class="value">{{ item.item_group || '-' }}</div>
          </div>
          <div class="info-item">
            <label>{{ t('branch.detail.item_name') }}</label>
            <div class="value">{{ item.item_name || item.item_code }}</div>
          </div>
          <div class="info-item">
            <label>{{ t('branch.detail.uom') }}</label>
            <div class="value">{{ item.stock_uom || 'Nos' }}</div>
          </div>
          <div class="info-item">
            <label>{{ t('branch.detail.pack_qty') }}</label>
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
            <!-- Tier 4 (BOX) -->
            <tr class="tier-box-row">
              <td class="tier-label tier-box-label">가격 4 (Precio 4 - BOX)</td>
              <td>
                <input type="text" v-model="tierBarcodes[3]" placeholder="BOX 바코드" class="input-text" />
              </td>
              <td>
                <input
                  type="number"
                  v-model.number="tierQtys[3]"
                  :disabled="!useCustomTierOverride"
                  class="input-qty tier-box-qty"
                  :class="{ readonly: !useCustomTierOverride }"
                />
              </td>
              <td>
                <input type="number" v-model.number="itemPrice.custom_tier_4_price" placeholder="0" class="input-price tier-box-price" />
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
import { useAuthStore } from '../../stores/auth.js'
import { upsertBranchItemPrice, branchPriceListCandidates } from '../../utils/branchPriceList.js'
import { frappeErrorMessage } from '../../utils/frappeError.js'
import {
  TIER_COUNT,
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
  },
  rawItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['go-back'])
const { t } = useI18n()
const authStore = useAuthStore()

// 창고명이 자동으로 붙는 접미사("CARMEN - K")를 그대로 쓴다.
// 관리자 화면과 지점 전용 화면이 같은 이름 규칙을 보도록 로그인 프로필의 지점명을 우선 사용한다.
const effectiveBranch = computed(() => {
  const fromProfile = String(authStore.user?.branch_name || '').trim()
  if (fromProfile) return fromProfile
  return String(props.currentBranch || '').trim()
})

const item = ref({})

// 저장 진행 상태. isSaving 은 중복 클릭 차단과 진행률 표시를 겸한다.
const isSaving = ref(false)
const saveDone = ref(0)
const saveTotal = ref(0)
const savePercent = computed(() =>
  saveTotal.value > 0 ? Math.round((saveDone.value / saveTotal.value) * 100) : 0
)

/**
 * 패밀리(변형) 식별 키.
 * custom_grid_group_id 는 수동으로 넣어준 품목에만 있고, 일반 ERPNext 변형 품목은
 * item_name 을 공유할 뿐이다. 그리드 플래그에만 의존하면 P-160 같은 색상/사이즈 변형
 * 패밀리가 통째로 누락되므로 item_name 을 폴백 키로 함께 쓴다.
 */
const familyKeyOf = (i) => String(i?.custom_grid_group_id || i?.item_name || '').trim()

/** 현재 보고 있는 품목과 같은 패밀리에 속한 rawItems 목록 (자기 자신 포함) */
const resolveFamilyItems = () => {
  const key = familyKeyOf(item.value)
  if (!key) return []
  return (props.rawItems || []).filter((i) => familyKeyOf(i) === key)
}

/**
 * 패밀리 변형 품목의 실제 item_code 전체 목록.
 *
 * props.rawItems 는 목록 로딩 시점이나 화면 필터에 따라 변형이 빠져 있을 수 있다.
 * 여기에만 의존하면 화면에 안 실린 변형(NEGRO, BLANCO 등)이 저장에서 통째로 누락되므로
 * 항상 백엔드를 기준으로 삼고, 로컬 목록은 보강용으로만 합친다.
 */
const fetchFamilyItemCodes = async () => {
  const key = familyKeyOf(item.value)
  const codes = []

  if (key) {
    try {
      const res = await frappeApi.get('/api/resource/Item', {
        params: {
          // 같은 패밀리라도 custom_grid_group_id 가 일부 품목에만 채워져 있다.
          // 둘 중 어느 쪽으로 묶여 있든 빠지지 않도록 OR 로 조회한다.
          or_filters: JSON.stringify([
            ['item_name', '=', key],
            ['custom_grid_group_id', '=', key]
          ]),
          fields: JSON.stringify(['name', 'item_code']),
          limit_page_length: 500
        }
      })
      ;(res.data?.data || []).forEach((i) => {
        const code = i.item_code || i.name
        if (code) codes.push(code)
      })
    } catch (e) {
      console.warn('패밀리 품목 조회 실패:', e?.response?.status || e)
    }
  }

  resolveFamilyItems().forEach((i) => {
    const code = i.item_code || i.name
    if (code) codes.push(code)
  })

  return [...new Set(codes)]
}
const branchBinList = ref([])
const ledgerList = ref([])
const toastMsg = ref('')

// 4단계 단가표 상태 (백엔드 Item Price 에 존재하는 단가 필드 수와 일치시켜야 한다)
const useCustomTierOverride = ref(false)
const tierBarcodes = ref(['', '', '', ''])
const tierQtys = ref([1, 10, 50, 100])
const itemPrice = ref({
  price_list_rate: 0,
  custom_tier_2_price: 0,
  custom_tier_3_price: 0,
  custom_tier_4_price: 0
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
    for (let i = 0; i < TIER_COUNT; i++) {
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

    // 개별 수량 Override 확인
    const savedOverride = getBranchItemOverride(props.currentBranch, props.itemId)
    if (savedOverride && savedOverride.useCustomOverride) {
      useCustomTierOverride.value = true
      tierQtys.value = savedOverride.tiers.slice(0, TIER_COUNT).map(t => Number(t.minQty || 0))
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
    // 두 가지 어긋남을 모두 흡수해야 저장된 단가가 화면에 뜬다.
    //  - 단가표 이름: 저장은 "Standard Selling - CARMEN - K" 와 "Standard Selling - CARMEN" 중
    //    실제 존재하는 쪽에 붙으므로, 조회도 후보 전부를 봐야 한다.
    //  - 품목 코드: P-160 은 그룹/부모 코드이고 실제 단가는 P-160-BEIGE-400 같은 변형에 들어간다.
    const priceItemCode = item.value?.item_code || props.itemId
    const branchPriceLists = branchPriceListCandidates(effectiveBranch.value)
    const priceListsToTry = [...branchPriceLists, 'Standard Selling']
    const fields = JSON.stringify([
      'name', 'item_code', 'price_list', 'price_list_rate',
      'custom_tier_2_price', 'custom_tier_3_price', 'custom_tier_4_price'
    ])
    const applyRow = (p) => {
      itemPrice.value = p
        ? {
            name: p.name,
            price_list: p.price_list,
            price_list_rate: Number(p.price_list_rate || 0),
            custom_tier_2_price: Number(p.custom_tier_2_price || 0),
            custom_tier_3_price: Number(p.custom_tier_3_price || 0),
            custom_tier_4_price: Number(p.custom_tier_4_price || 0)
          }
        : {
            price_list_rate: 0,
            custom_tier_2_price: 0,
            custom_tier_3_price: 0,
            custom_tier_4_price: 0
          }
    }
    // 여러 건이 잡히면 지점 단가표 > 본사 단가표, 그리고 지금 보고 있는 품목 코드 순으로 고른다.
    const pickBestRow = (rows, itemCodeOrder) => {
      const rank = (r) => {
        const pl = priceListsToTry.indexOf(r.price_list)
        const ic = itemCodeOrder.indexOf(r.item_code)
        return [pl < 0 ? 99 : pl, ic < 0 ? 99 : ic]
      }
      return [...rows].sort((a, b) => {
        const ra = rank(a)
        const rb = rank(b)
        return ra[0] - rb[0] || ra[1] - rb[1]
      })[0] || null
    }

    const queryPrices = async (itemCodes) => {
      const res = await frappeApi.get('/api/resource/Item Price', {
        params: {
          filters: JSON.stringify([
            ['item_code', 'in', itemCodes],
            ['price_list', 'in', priceListsToTry]
          ]),
          fields,
          limit_page_length: 100
        }
      })
      return res.data.data || []
    }

    try {
      // 1순위: 지금 열려 있는 품목 코드로 지점/본사 단가표를 한 번에 조회
      let rows = await queryPrices([priceItemCode])
      let itemCodeOrder = [priceItemCode]

      // 2순위: 변형 품목 폴백.
      // rawItems 가 아직 로드되지 않은 상태(onMounted 직후)여도 작동하도록
      // 패밀리 변형 코드를 백엔드에서 직접 조회한다.
      if (rows.length === 0) {
        const uniqueCodes = (await fetchFamilyItemCodes()).filter(c => c !== priceItemCode)
        if (uniqueCodes.length > 0) {
          itemCodeOrder = uniqueCodes
          rows = await queryPrices(uniqueCodes)
        }
      }

      applyRow(pickBestRow(rows, itemCodeOrder))
    } catch (pe) {
      console.error('Item Price load failed:', pe?.response?.status, pe?.response?.data || pe)
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
  // 전파는 수 초가 걸리므로, 그 사이 다시 눌러 중복 요청이 나가는 것을 막는다.
  if (isSaving.value) return
  isSaving.value = true
  saveDone.value = 0
  saveTotal.value = 0

  try {
    // 1. 개별 수량구간 Override 저장
    saveBranchItemOverride(props.currentBranch, props.itemId, {
      useCustomOverride: useCustomTierOverride.value,
      tiers: [
        { minQty: Number(tierQtys.value[0] || 0), label: '가격 1 (Precio 1)' },
        { minQty: Number(tierQtys.value[1] || 0), label: '가격 2 (Precio 2)' },
        { minQty: Number(tierQtys.value[2] || 0), label: '가격 3 (Precio 3)' },
        { minQty: Number(tierQtys.value[3] || 0), label: '가격 4 (Precio 4 - BOX)' }
      ]
    })

    // 1-1. Item 마스터에 1~4단계 바코드 저장
    try {
      await frappeApi.put(`/api/resource/Item/${encodeURIComponent(props.itemId)}`, {
        custom_tier_1_barcode: (tierBarcodes.value[0] || '').trim(),
        custom_tier_2_barcode: (tierBarcodes.value[1] || '').trim(),
        custom_tier_3_barcode: (tierBarcodes.value[2] || '').trim(),
        custom_tier_4_barcode: (tierBarcodes.value[3] || '').trim()
      })
    } catch (barcodeErr) {
      console.warn('Item barcode update warning (may require permissions):', barcodeErr)
    }

    // 2. 지점 Item Price 저장 (단가표가 없으면 자동 생성 후 Upsert)
    const payload = {
      price_list_rate: Number(itemPrice.value.price_list_rate || 0),
      custom_tier_2_price: Number(itemPrice.value.custom_tier_2_price || 0),
      custom_tier_3_price: Number(itemPrice.value.custom_tier_3_price || 0),
      custom_tier_4_price: Number(itemPrice.value.custom_tier_4_price || 0)
    }
    const saveItemCode = item.value?.item_code || props.itemId

    // 패밀리(변형) 상품이면 변형 전체에 일괄 전파하고, 아니면 단일 품목만 저장한다.
    // 전파 대상은 저장 시점에 백엔드에서 다시 확보한다. 화면 메모리(rawItems)만 믿으면
    // 목록에 안 실린 변형이 저장에서 빠져 POS 에서 0원으로 나온다.
    const familyCodes = await fetchFamilyItemCodes()

    if (familyCodes.length > 1) {
      const codes = [...familyCodes]
      if (!codes.includes(saveItemCode)) codes.push(saveItemCode)

      saveTotal.value = codes.length
      const failed = []
      for (const code of codes) {
        try {
          await upsertBranchItemPrice(frappeApi, {
            branchName: effectiveBranch.value,
            itemCode: code,
            payload
          })
        } catch (e) {
          failed.push(code)
          console.error(`단가 전파 실패 (${code}):`, e, e?.response?.data)
        }
        saveDone.value += 1
      }

      // 전파 후에는 화면이 들고 있던 레코드 name 이 낡을 수 있으므로 다음 조회에 맡긴다.
      itemPrice.value.name = null

      if (failed.length > 0) {
        alert(
          `⚠️ ${codes.length}개 변형 중 ${failed.length}개 저장에 실패했습니다.\n` +
            `실패 품목: ${failed.join(', ')}`
        )
      } else {
        showToast(`💾 패밀리 ${codes.length}개 변형에 지점 단가가 일괄 저장되었습니다.`)
      }
    } else {
      const savedName = await upsertBranchItemPrice(frappeApi, {
        branchName: effectiveBranch.value,
        itemCode: saveItemCode,
        knownName: itemPrice.value.name || null,
        payload
      })
      if (savedName) {
        itemPrice.value.name = savedName
      }
      showToast('💾 지점별 단가 및 4단계 수량구간이 저장되었습니다.')
    }
  } catch (error) {
    console.error('Save branch price error:', error, error?.response?.data)
    alert('❌ 저장 중 오류가 발생했습니다:\n' + frappeErrorMessage(error))
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  fetchDetailData()
})

watch(() => props.itemId, () => {
  fetchDetailData()
})

// rawItems 는 비동기로 늦게 도착한다. 마운트 시점에 비어 있어 단가를 못 찾은 경우를 위해 재조회한다.
watch(
  () => props.rawItems.length,
  (len, prevLen) => {
    if (len > 0 && !prevLen) fetchDetailData()
  }
)
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

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  background: linear-gradient(135deg, #059669, #047857);
}

.btn-save:disabled {
  background: #334155;
  color: #94a3b8;
  box-shadow: none;
  cursor: progress;
  transform: none;
}

.save-progress {
  position: relative;
  margin: 0 0 14px;
  height: 24px;
  border-radius: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  overflow: hidden;
}

.save-progress-bar {
  height: 100%;
  background: linear-gradient(135deg, #10b981, #059669);
  transition: width 0.2s ease;
}

.save-progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #e2e8f0;
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

.tier-box-row {
  background-color: rgba(245, 158, 11, 0.08);
}

.tier-box-label {
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

.tier-box-qty {
  border-color: #f59e0b;
  color: #fbbf24;
  font-weight: 800;
}

.tier-box-price {
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
