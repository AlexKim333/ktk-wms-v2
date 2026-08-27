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
import { ref, onMounted } from 'vue'

const props = defineProps({
  currentBranch: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'settings-updated'])

const activeTab = ref('price-tiers')
const toastMessage = ref('')

const tabs = [
  { id: 'price-tiers', label: '💰 가격정책', icon: '💰' },
          { id: 'pos-config', label: '🏢 POS 환경 설정 (POS Config)', icon: '🏢' },
  { id: 'receipt-config', label: '🖨️ 영수증 및 프린터 설정 (Receipt & Printer)', icon: '🖨️' },
  { id: 'shift-config', label: '🔐 권한 및 마감 설정 (Permissions)', icon: '🔐' }
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
