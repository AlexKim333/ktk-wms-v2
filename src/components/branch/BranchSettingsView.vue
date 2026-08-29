<template>
  <div class="branch-settings-container">
    <!-- Top Header & Breadcrumb Style -->
    <header class="settings-header">
      <div class="header-left">
        <div class="breadcrumb">
          <span class="breadcrumb-item">{{ t('branch_settings_title', '지점 설정') }}</span>
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-current">{{ currentBranch || 'KTK-WMS-BRANCH' }}</span>
        </div>
        <h1 class="page-title">{{ t('branch_settings_page_title', '지점 POS 및 수량별 단가 설정') }}</h1>
      </div>

      <div class="header-actions">
        <button class="btn-reset" @click="handleResetTiers" :title="t('reset_default', '기본값 복원')">
          🔄 {{ t('reset_default', '기본값 복원') }}
        </button>
        <button class="btn-save" @click="handleSaveSettings">
          💾 {{ t('save_settings', '설정 저장') }}
        </button>
        <button class="btn-close" @click="$emit('close')" :title="t('close', '닫기')">
          ✕
        </button>
      </div>
    </header>

    <!-- Frappe Cloud Style Horizontal Tabs Bar (Underline Active Style) -->
    <nav class="tabs-nav">
      <div class="tabs-list">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-item"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </div>
    </nav>

    <!-- Tab 1: Price Tiers (수량 구간 및 단가 설정 - 5개 입력란) -->
    <main class="settings-content">
      <div v-if="activeTab === 'price-tiers'" class="tab-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">💰 {{ t('tier_settings_title', '가격정책: 5단계 수량구간 설정') }}</h2>
            <p class="panel-desc">
              {{ t('tier_settings_desc', '현장에서 상품 판매 시, 장바구니 수량에 따라 적용될 5단계 수량 구간 기준을 설정합니다.') }}
            </p>
          </div>
          <div class="panel-badge">
            <span class="badge-status">⚡ {{ t('auto_memory_active', '스마트 단가 기억 엔진 가동중') }}</span>
          </div>
        </div>

        <!-- 5 Tiers Configuration Card -->
        <div class="tiers-card">
          <div class="table-responsive">
            <table class="tiers-table">
              <thead>
                <tr>
                  <th style="width: 80px;">{{ t('tier_no', '구간') }}</th>
                  <th style="width: 220px;">{{ t('tier_name', '구간 명칭 / 라벨') }}</th>
                  <th style="width: 180px;">{{ t('tier_min_qty', '기준 최소 수량(개)') }}</th>
                  <th>{{ t('tier_description', '구간 설명 및 용도') }}</th>
                  <th style="width: 110px; text-align: center;">{{ t('tier_badge', '뱃지') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(tier, index) in priceTiers" :key="index" class="tier-row">
                  <td class="tier-no-cell">
                    <span class="tier-badge-no">{{ index + 1 }}</span>
                  </td>
                  <td>
                    <input
                      type="text"
                      v-model="tier.label"
                      class="form-input"
                      :placeholder="t('tier_name_placeholder', '구간 명칭')"
                    />
                  </td>
                  <td>
                    <div class="qty-input-wrapper">
                      <input
                        type="number"
                        v-model.number="tier.minQty"
                        class="form-input qty-input"
                        min="1"
                        @change="sortTiersIfRequired"
                      />
                      <span class="qty-unit">{{ t('qty_unit_above', '개 이상') }}</span>
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      v-model="tier.desc"
                      class="form-input"
                      :placeholder="t('tier_desc_placeholder', '예: 10장 이상 팩 할인 적용 구간')"
                    />
                  </td>
                  <td style="text-align: center;">
                    <span class="badge-preview" :style="{ backgroundColor: tier.color }">
                      {{ tier.label || ('Tier ' + (index + 1)) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card-footer-info">
            <div class="info-item">
              <span class="info-icon">💡</span>
              <span class="info-text">
                {{ t('tier_info_1', '입력된 기준 수량에 맞추어 장바구니 품목 수량이 변경될 때마다, 과거에 팔았던 단가를 자동 입력합니다.') }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-icon">🔄</span>
              <span class="info-text">
                {{ t('tier_info_2', '현장에서 단가를 클릭해 변경하면 즉시 해당 구간의 단가 메모리가 최신 금액으로 자동 갱신됩니다.') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: POS Config -->
      <div v-else-if="activeTab === 'pos-config'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">🏢 {{ t('pos_config_title', 'POS 환경 설정') }}</h2>
          <p class="panel-desc">{{ t('pos_config_desc', '지점 POS 사용 시 기본 통화, 세금 포함 여부, 스캐너 옵션 등을 설정합니다.') }}</p>
        </div>
        <div class="placeholder-card">
          <p class="placeholder-text">{{ t('pos_config_ready', 'POS 환경 설정 항목이 적용될 준비가 되었습니다.') }}</p>
        </div>
      </div>

      <!-- Tab 3: Receipt & Printer -->
      <div v-else-if="activeTab === 'receipt-config'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">🖨️ {{ t('receipt_config_title', '영수증 및 프린터 설정') }}</h2>
          <p class="panel-desc">{{ t('receipt_config_desc', '현장 POS 영수증 출력을 위한 하단 문구, 로고 및 58mm/80mm 프린터 옵션입니다.') }}</p>
        </div>
        <div class="placeholder-card">
          <p class="placeholder-text">{{ t('receipt_config_ready', '영수증 및 열전사 프린터 연결 준비가 완료되었습니다.') }}</p>
        </div>
      </div>

      <!-- Tab 4: Shift & Permissions -->
      <div v-else-if="activeTab === 'shift-config'" class="tab-panel">
        <div class="panel-header">
          <h2 class="panel-title">🔐 {{ t('shift_config_title', '권한 및 영업 마감 설정') }}</h2>
          <p class="panel-desc">{{ t('shift_config_desc', '지점 근무자의 단가 수정 권한 및 일일 마감 레포트 설정을 관리합니다.') }}</p>
        </div>
        <div class="placeholder-card">
          <p class="placeholder-text">{{ t('shift_config_ready', '영업 마감 및 권한 제어 설정이 활성화되었습니다.') }}</p>
        </div>
      </div>

      <!-- Tab 5: 고객 등록 -->
      <div v-else-if="activeTab === 'customer-reg'" class="tab-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">🧑‍🤝‍🧑 {{ t('customer_reg_title', '신규 고객 등록') }}</h2>
            <p class="panel-desc">{{ currentBranch }}{{ t('customer_reg_desc', ' 지점에서 새로운 고객을 등록합니다. 전화번호는 필수 입력입니다.') }}</p>
          </div>
        </div>

        <div class="tiers-card" style="padding: 24px;">
          <form @submit.prevent="registerCustomer" class="customer-form-grid">
            <label class="form-field-block">
              <span>{{ t('cust_name_label', '고객명') }} *</span>
              <input type="text" v-model="custForm.name" required class="form-input" :placeholder="t('cust_name_ph', '고객 이름 또는 상호')" />
            </label>
            <label class="form-field-block">
              <span>{{ t('cust_phone_label', '전화번호') }} *</span>
              <input type="text" v-model="custForm.phone" required class="form-input" :placeholder="t('cust_phone_ph', '예: +52 55 1234 5678')" />
            </label>
            <label class="form-field-block">
              <span>{{ t('cust_sales_person_label', '담당 판매원') }}</span>
              <select v-model="custForm.salesPerson" class="form-input">
                <option value="">{{ t('cust_sales_person_none', '선택 안 함') }}</option>
                <option v-for="sp in branchSalesPersons" :key="sp.name" :value="sp.name">{{ sp.sales_person_name || sp.name }}</option>
              </select>
            </label>

            <div class="form-field-block full-width">
              <span>{{ t('cust_address_label', '주소 (선택 사항)') }}</span>
              <div v-for="(addr, idx) in custForm.addresses" :key="addr.id" class="address-row">
                <input type="text" v-model="addr.city" class="form-input" :placeholder="t('cust_city_ph', '도시')" style="width: 30%;" />
                <input type="text" v-model="addr.val" class="form-input" :placeholder="t('cust_addr_ph', '상세 주소')" style="flex:1;" />
                <button v-if="custForm.addresses.length > 1" type="button" class="btn-reset" @click="custForm.addresses.splice(idx, 1)">🗑️</button>
              </div>
              <button type="button" class="btn-reset" style="width: fit-content; margin-top: 6px;" @click="custForm.addresses.push({ id: Date.now(), val: '', city: '' })">
                ➕ {{ t('cust_add_address', '주소 추가') }}
              </button>
            </div>

            <div class="form-field-block full-width" style="margin-top: 10px;">
              <button type="submit" class="btn-save" :disabled="isRegisteringCustomer" style="width: fit-content;">
                {{ isRegisteringCustomer ? t('saving', '저장 중...') : t('cust_register_btn', '💾 고객 등록') }}
              </button>
            </div>
          </form>
        </div>

        <div class="tiers-card" style="margin-top: 20px;">
          <div class="table-responsive">
            <table class="tiers-table">
              <thead>
                <tr>
                  <th>{{ t('cust_col_name', '고객명') }}</th>
                  <th>{{ t('cust_col_phone', '전화번호') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in branchCustomers" :key="c.name">
                  <td>{{ c.customer_name }}</td>
                  <td>{{ c.mobile_no || '-' }}</td>
                </tr>
                <tr v-if="branchCustomers.length === 0">
                  <td colspan="2" style="text-align: center; color: #94a3b8; padding: 20px;">{{ t('cust_list_empty', '등록된 고객이 없습니다.') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab 6: 상품 등록 요청 -->
      <div v-else-if="activeTab === 'product-req'" class="tab-panel">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">📦 {{ t('prod_req_title', '신규 상품 등록 요청') }}</h2>
            <p class="panel-desc">{{ t('prod_req_desc', '여기서 등록한 상품은 본사 승인 전까지 비활성 상태이며 판매 화면에 노출되지 않습니다. 원가/재고는 본사 승인 시 확정됩니다.') }}</p>
          </div>
        </div>

        <div class="tiers-card" style="padding: 24px;">
          <form @submit.prevent="registerProductRequest" class="customer-form-grid">
            <label class="form-field-block">
              <span>{{ t('prod_name_label', '상품명') }} *</span>
              <input type="text" v-model="prodForm.name" required class="form-input" :placeholder="t('prod_name_ph', '예: P-160')" />
            </label>
            <label class="form-field-block">
              <span>{{ t('prod_color_label', '색상') }} *</span>
              <input type="text" v-model="prodForm.color" required class="form-input" :placeholder="t('prod_color_ph', '예: BLACK')" />
            </label>
            <label class="form-field-block">
              <span>{{ t('prod_brand_label', '브랜드') }} *</span>
              <select v-model="prodForm.brand" required class="form-input">
                <option value="" disabled>{{ t('prod_brand_select', '브랜드 선택') }}</option>
                <option v-for="b in brandList" :key="b.name" :value="b.name">{{ b.name }}</option>
              </select>
            </label>
            <label class="form-field-block">
              <span>{{ t('prod_pack_label', '팩 수량') }} *</span>
              <input type="number" v-model.number="prodForm.packQty" min="1" required class="form-input" :placeholder="t('prod_pack_ph', '예: 12')" />
            </label>
            <label class="form-field-block">
              <span>{{ t('prod_barcode_label', '바코드 (선택)') }}</span>
              <input type="text" v-model="prodForm.barcode" class="form-input" :placeholder="t('prod_barcode_ph', '스캐너 입력')" />
            </label>
            <label class="form-field-block">
              <span>{{ t('prod_suggested_price_label', '희망 판매가 (참고용, 선택)') }}</span>
              <input type="number" v-model.number="prodForm.suggestedPrice" min="0" step="0.01" class="form-input" :placeholder="t('prod_suggested_price_ph', '본사 승인 시 참고')" />
            </label>
            <label class="form-field-block full-width">
              <span>{{ t('prod_note_label', '요청 사유 / 메모 (선택)') }}</span>
              <input type="text" v-model="prodForm.note" class="form-input" :placeholder="t('prod_note_ph', '예: 신제품 출시, 지점 자체 발주 등')" />
            </label>

            <div class="form-field-block full-width" style="margin-top: 10px;">
              <button type="submit" class="btn-save" :disabled="isRegisteringProduct" style="width: fit-content;">
                {{ isRegisteringProduct ? t('saving', '저장 중...') : t('prod_register_btn', '📤 등록 요청 보내기') }}
              </button>
            </div>
          </form>
        </div>

        <div class="tiers-card" style="margin-top: 20px;">
          <div class="table-responsive">
            <table class="tiers-table">
              <thead>
                <tr>
                  <th>{{ t('prod_col_name', '상품명') }}</th>
                  <th>{{ t('prod_col_color', '색상') }}</th>
                  <th>{{ t('prod_col_status', '상태') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in branchProductRequests" :key="p.name">
                  <td>{{ p.item_name }}</td>
                  <td>{{ p.custom_color || '-' }}</td>
                  <td>
                    <span v-if="p.custom_pending_review" style="color:#b45309; font-weight:700;">{{ t('prod_status_pending', '⏳ 승인 대기중') }}</span>
                    <span v-else-if="!p.disabled" style="color:#047857; font-weight:700;">{{ t('prod_status_approved', '✅ 승인 완료') }}</span>
                    <span v-else style="color:#94a3b8;">{{ t('prod_status_rejected', '반려/보류') }}</span>
                  </td>
                </tr>
                <tr v-if="branchProductRequests.length === 0">
                  <td colspan="3" style="text-align: center; color: #94a3b8; padding: 20px;">{{ t('prod_list_empty', '등록 요청한 상품이 없습니다.') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>

    <!-- Notification Toast -->
    <transition name="fade">
      <div v-if="toastMessage" class="toast-popup">
        {{ toastMessage }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import frappeApi from '../../api/frappe.js'

const props = defineProps({
  currentBranch: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'settings-updated'])

const activeTab = ref('price-tiers')
const toastMessage = ref('')

// --- 고객 등록 (customer-reg 탭) ---
const custForm = ref({ name: '', phone: '', salesPerson: '', addresses: [{ id: Date.now(), val: '', city: '' }] })
const isRegisteringCustomer = ref(false)
const branchSalesPersons = ref([])
const branchCustomers = ref([])

const fetchBranchSalesPersons = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Sales Person', {
      params: {
        fields: JSON.stringify(['name', 'sales_person_name']),
        filters: JSON.stringify([['enabled', '=', 1], ['custom_branch', '=', props.currentBranch]]),
        limit_page_length: 0
      }
    })
    branchSalesPersons.value = res.data?.data || []
  } catch (e) {
    console.error('Failed to fetch branch sales persons:', e)
  }
}

const fetchBranchCustomers = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Customer', {
      params: {
        fields: JSON.stringify(['name', 'customer_name', 'mobile_no']),
        filters: JSON.stringify([['custom_managing_branch', '=', props.currentBranch]]),
        limit_page_length: 0,
        order_by: 'creation desc'
      }
    })
    branchCustomers.value = res.data?.data || []
  } catch (e) {
    console.error('Failed to fetch branch customers:', e)
  }
}

const registerCustomer = async () => {
  const name = custForm.value.name.trim()
  const phone = custForm.value.phone.trim()
  if (!name || !phone) {
    showToast('❌ 고객명과 전화번호는 필수 입력 항목입니다.')
    return
  }

  isRegisteringCustomer.value = true
  try {
    // 담당 판매원: Sales Invoice/Sales Order와 동일한 표준 sales_team 자식테이블 재사용.
    // 관리지점은 지점장 본인 소속 지점으로 고정 — 노드관리와 달리 판매원 지점을 조회할 필요가 없다.
    const custRes = await frappeApi.post('/api/resource/Customer', {
      customer_name: name,
      customer_group: 'Commercial',
      territory: 'All Territories',
      sales_team: custForm.value.salesPerson ? [{ sales_person: custForm.value.salesPerson, allocated_percentage: 100 }] : [],
      custom_managing_branch: props.currentBranch || undefined
    })
    const createdName = custRes.data.data.name

    // 전화번호는 Contact 문서로 저장 (mobile_no는 phone_nos 자식테이블에서 계산되는 읽기전용 필드)
    const contactRes = await frappeApi.post('/api/resource/Contact', {
      first_name: name,
      phone_nos: [{ phone, is_primary_mobile_no: 1 }],
      links: [{ link_doctype: 'Customer', link_name: createdName }]
    })
    await frappeApi.put(`/api/resource/Customer/${encodeURIComponent(createdName)}`, { customer_primary_contact: contactRes.data.data.name })

    // 주소 (선택 사항, 여러 개 가능)
    for (const addr of custForm.value.addresses) {
      if (addr.val.trim() !== '') {
        await frappeApi.post('/api/resource/Address', {
          address_title: name,
          address_type: 'Billing',
          address_line1: addr.val.trim(),
          city: addr.city ? addr.city.trim() : 'Unknown City',
          links: [{ link_doctype: 'Customer', link_name: createdName }]
        })
      }
    }

    showToast(`✅ 고객 "${name}" 등록 완료`)
    custForm.value = { name: '', phone: '', salesPerson: '', addresses: [{ id: Date.now(), val: '', city: '' }] }
    await fetchBranchCustomers()
  } catch (e) {
    let detailMsg = '알 수 없는 오류'
    if (e.response?.data?._server_messages) {
      try {
        detailMsg = JSON.parse(e.response.data._server_messages).map((m) => JSON.parse(m).message).join('\n')
      } catch (_) {
        detailMsg = e.response.data._server_messages
      }
    }
    showToast(`❌ 등록 실패: ${detailMsg}`)
  } finally {
    isRegisteringCustomer.value = false
  }
}

watch(activeTab, (val) => {
  if (val === 'customer-reg') {
    fetchBranchSalesPersons()
    fetchBranchCustomers()
  } else if (val === 'product-req') {
    fetchBrandList()
    fetchBranchProductRequests()
  }
})

// --- 상품 등록 요청 (product-req 탭) ---
const prodForm = ref({ name: '', color: '', brand: '', packQty: null, barcode: '', suggestedPrice: null, note: '' })
const isRegisteringProduct = ref(false)
const brandList = ref([])
const branchProductRequests = ref([])

const fetchBrandList = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Brand', { params: { fields: JSON.stringify(['name']), limit_page_length: 0 } })
    brandList.value = res.data?.data || []
  } catch (e) {
    console.error('Failed to fetch brand list:', e)
  }
}

const fetchBranchProductRequests = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Item', {
      params: {
        fields: JSON.stringify(['name', 'item_name', 'custom_color', 'disabled', 'custom_pending_review']),
        filters: JSON.stringify([['description', 'like', `%[지점요청:${props.currentBranch}]%`]]),
        limit_page_length: 0,
        order_by: 'creation desc'
      }
    })
    branchProductRequests.value = res.data?.data || []
  } catch (e) {
    console.error('Failed to fetch branch product requests:', e)
  }
}

const registerProductRequest = async () => {
  const name = prodForm.value.name.trim()
  const color = prodForm.value.color.trim()
  const packQty = Number(prodForm.value.packQty)
  if (!name || !color || !prodForm.value.brand || !Number.isFinite(packQty) || packQty < 1) {
    showToast('❌ 상품명/색상/브랜드/팩 수량은 필수 입력 항목입니다.')
    return
  }

  isRegisteringProduct.value = true
  try {
    let itemCode = `${name}-${color}`
    if (packQty > 1) itemCode += `-${packQty}`

    // 요청 정보(지점/요청자/희망판매가/메모)는 별도 필드 없이 description에 구조화된 텍스트로 남긴다 —
    // 본사 승인 화면과 이 목록 둘 다 이 텍스트로 지점을 식별한다.
    const noteLines = [
      `[지점요청:${props.currentBranch}]`,
      `희망판매가: ${prodForm.value.suggestedPrice || '미입력'}`,
      prodForm.value.note ? `메모: ${prodForm.value.note}` : ''
    ].filter(Boolean)

    // 비활성(disabled=1) + 승인대기(custom_pending_review=1) 상태로만 생성 —
    // 원가/재고/가격 입력란 자체가 없어 재고평가·회계에 전혀 영향을 주지 않는다.
    await frappeApi.post('/api/resource/Item', {
      item_code: itemCode,
      item_name: name,
      item_group: 'Products',
      brand: prodForm.value.brand,
      stock_uom: 'Nos',
      is_stock_item: 1,
      has_variants: 0,
      disabled: 1,
      custom_pending_review: 1,
      custom_color: color,
      custom_pack_qty: packQty,
      custom_tier_1_barcode: prodForm.value.barcode.trim() || null,
      description: noteLines.join('\n')
    })

    showToast(`✅ "${name}" 상품 등록 요청을 보냈습니다. 본사 승인을 기다려주세요.`)
    prodForm.value = { name: '', color: '', brand: '', packQty: null, barcode: '', suggestedPrice: null, note: '' }
    await fetchBranchProductRequests()
  } catch (e) {
    let detailMsg = '알 수 없는 오류'
    if (e.response?.data?._server_messages) {
      try {
        detailMsg = JSON.parse(e.response.data._server_messages).map((m) => JSON.parse(m).message).join('\n')
      } catch (_) {
        detailMsg = e.response.data._server_messages
      }
    }
    showToast(`❌ 등록 요청 실패: ${detailMsg}`)
  } finally {
    isRegisteringProduct.value = false
  }
}

const tabs = [
  { id: 'price-tiers', label: '💰 가격정책', icon: '💰' },
          { id: 'pos-config', label: '🏢 POS 환경 설정 (POS Config)', icon: '🏢' },
  { id: 'receipt-config', label: '🖨️ 영수증 및 프린터 설정 (Receipt & Printer)', icon: '🖨️' },
  { id: 'shift-config', label: '🔐 권한 및 마감 설정 (Permissions)', icon: '🔐' },
  { id: 'customer-reg', label: '🧑‍🤝‍🧑 고객 등록', icon: '🧑‍🤝‍🧑' },
  { id: 'product-req', label: '📦 상품 등록 요청', icon: '📦' }
]

// 4 Quantity Tiers default config
const defaultTiers = [
  { minQty: 1, label: '1구간 (단품)', desc: '1개 이상 소량/단품 판매 단가', color: '#3b82f6' },
  { minQty: 10, label: '2구간 (소팩)', desc: '10개 이상 소팩 할인 단가', color: '#10b981' },
  { minQty: 50, label: '3구간 (중팩)', desc: '50개 이상 중팩 할인 단가', color: '#f59e0b' },
  { minQty: 100, label: '4구간 (박스)', desc: '100개 이상 상자/특판 판매 단가', color: '#8b5cf6' }
]

const priceTiers = ref([...defaultTiers.map(t => ({ ...t }))])

// Simple internationalization fallback helper
const t = (key, defaultKo) => {
  return defaultKo
}

onMounted(() => {
  loadSavedTiers()
})

const getStorageKey = () => props.currentBranch ? `branch_price_tiers_${props.currentBranch}_v1` : 'branch_price_tiers_v1'

const loadSavedTiers = () => {
  try {
    let saved = localStorage.getItem(getStorageKey())
    if (!saved && props.currentBranch) {
      saved = localStorage.getItem('branch_price_tiers_v1')
    }
    if (saved) {
      const parsed = JSON.parse(saved)
      // 5구간 시절 설정이 남아 있어도 현재 구간 수만큼만 쓴다.
      if (Array.isArray(parsed) && parsed.length >= defaultTiers.length) {
        priceTiers.value = parsed.slice(0, defaultTiers.length)
        return
      }
    }
  } catch (e) {
    console.error('Failed to load price tiers:', e)
  }
  priceTiers.value = defaultTiers.map(t => ({ ...t }))
}

const sortTiersIfRequired = () => {
  // Optional: keep minQty sorted in ascending order if desired, or let user order freely
}

const handleResetTiers = () => {
  if (confirm('수량 구간 설정을 기본값(1개, 10개, 50개, 100개)으로 복원하시겠습니까?')) {
    priceTiers.value = defaultTiers.map(t => ({ ...t }))
    showToast('🔄 기본 수량 구간으로 복원되었습니다.')
  }
}

const handleSaveSettings = () => {
  try {
    const key = getStorageKey()
    localStorage.setItem(key, JSON.stringify(priceTiers.value))
    localStorage.setItem('branch_price_tiers_v1', JSON.stringify(priceTiers.value))
    showToast('💾 지점 수량 구간 및 단가 설정이 저장되었습니다.')
    emit('settings-updated', priceTiers.value)
  } catch (e) {
    console.error('Failed to save settings:', e)
    showToast('❌ 설정 저장 중 오류가 발생했습니다.')
  }
}

const showToast = (msg) => {
  toastMessage.value = msg
  setTimeout(() => {
    toastMessage.value = ''
  }, 2500)
}
</script>

<style scoped>
.branch-settings-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f8fafc;
  color: #0f172a;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
}

/* Header */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 28px;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 4px;
}

.breadcrumb-current {
  color: #0f172a;
  font-weight: 600;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-reset {
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  background-color: #ffffff;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background-color: #f1f5f9;
  border-color: #94a3b8;
}

.btn-save {
  padding: 9px 18px;
  border: none;
  background-color: #2563eb;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
  transition: all 0.2s;
}

.btn-save:hover {
  background-color: #1d4ed8;
}

.btn-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  background-color: #ffffff;
  color: #64748b;
  font-size: 16px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-close:hover {
  background-color: #f8fafc;
  color: #0f172a;
}

/* Frappe Cloud Horizontal Tabs Nav */
.tabs-nav {
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 28px;
}

.tabs-list {
  display: flex;
  gap: 24px;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 4px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-item:hover {
  color: #0f172a;
}

.tab-item.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  font-weight: 700;
}

/* Content Area */
.settings-content {
  flex: 1;
  padding: 28px;
  overflow-y: auto;
}

.tab-panel {
  max-width: 1100px;
  margin: 0 auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.panel-desc {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.badge-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background-color: #ecfdf5;
  color: #047857;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9999px;
  border: 1px solid #a7f3d0;
}

/* Tiers Card & Table */
.tiers-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.table-responsive {
  overflow-x: auto;
}

.tiers-table {
  width: 100%;
  border-collapse: collapse;
}

.tiers-table th {
  background-color: #f8fafc;
  padding: 12px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
}

.tiers-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.tier-no-cell {
  text-align: center;
}

.tier-badge-no {
  display: inline-block;
  width: 26px;
  height: 26px;
  line-height: 26px;
  background-color: #f1f5f9;
  color: #334155;
  border-radius: 50%;
  font-weight: 700;
  font-size: 13px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  color: #0f172a;
  background-color: #ffffff;
  transition: border-color 0.15s;
}

.form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.qty-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-input {
  width: 90px;
  text-align: right;
  font-weight: 700;
}

.qty-unit {
  font-size: 13px;
  color: #64748b;
  white-space: nowrap;
}

.badge-preview {
  display: inline-block;
  padding: 4px 10px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
}

/* Card Footer */
.card-footer-info {
  background-color: #f8fafc;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-icon {
  font-size: 16px;
}

.info-text {
  font-size: 13px;
  color: #475569;
}

/* 고객 등록 탭 */
.customer-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-field-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 700;
  font-size: 13px;
  color: #334155;
}

.form-field-block.full-width {
  grid-column: 1 / -1;
}

.address-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

/* Placeholder card for other tabs */
.placeholder-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 60px 20px;
  text-align: center;
}

.placeholder-text {
  font-size: 15px;
  color: #64748b;
}

/* Toast Notification */
.toast-popup {
  position: fixed;
  bottom: 28px;
  right: 28px;
  background-color: #1e293b;
  color: #ffffff;
  padding: 12px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  font-weight: 600;
  z-index: 9999;
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
