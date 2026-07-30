<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="closeModal">
    <div class="modal-card">
      <!-- 헤더 -->
      <div class="modal-header">
        <div class="header-title-row">
          <h3>
            <span class="warn-badge">⚠️ 단가표 미완성</span>
            총 {{ items.length }}개 품목의 가격 정보가 미완성입니다. (1-{{ items.length }})
          </h3>
          <button class="btn-close" @click="closeModal">✕</button>
        </div>
        <div class="progress-bar-container">
          <div
            class="progress-bar-fill"
            :style="{ width: `${((currentIndex + 1) / items.length) * 100}%` }"
          ></div>
        </div>
      </div>

      <!-- 바디 (현재 상품 상세 정보 및 5단계 단가 입력) -->
      <div v-if="currentItem" class="modal-body">
        <div class="item-info-banner">
          <div class="info-item">
            <span class="label">진행 순서</span>
            <span class="val text-amber">[{{ currentIndex + 1 }} / {{ items.length }}]</span>
          </div>
          <div class="info-item">
            <span class="label">품목명 (Item Name)</span>
            <span class="val font-bold">{{ currentItem.item_name }} ({{ currentItem.item_code }})</span>
          </div>
          <div class="info-item" v-if="currentItem.grid_group_id">
            <span class="label">그리드 그룹 (Grid Style)</span>
            <span class="val text-cyan">{{ currentItem.grid_group_id }}</span>
          </div>
          <div class="info-item">
            <span class="label">박스 포장수량 (Box Pack Qty)</span>
            <span class="val text-orange">📦 {{ currentItem.custom_pack_qty || 1 }} Nos / Box</span>
          </div>
        </div>

        <div class="tiers-input-section">
          <h4>📊 5단계 수량구간 단가 입력 (기존 입력가 표시 & 수정 가능)</h4>
          <p class="section-desc">
            비어있거나 0원인 구간 가격을 채워주시면 해당 지점의 영구 단가표에 반영됩니다.
          </p>

          <div class="tiers-grid">
            <div class="tier-card" :class="{ 'is-empty': !formPrices[0] || formPrices[0] === 0 }">
              <div class="tier-header">
                <span class="tier-badge">1구간</span>
                <span class="tier-name">가격 1 (단품 기본가)</span>
              </div>
              <div class="input-wrapper">
                <span class="currency-symbol">$</span>
                <input
                  type="number"
                  v-model.number="formPrices[0]"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="price-input"
                />
              </div>
            </div>

            <div class="tier-card" :class="{ 'is-empty': !formPrices[1] || formPrices[1] === 0 }">
              <div class="tier-header">
                <span class="tier-badge">2구간</span>
                <span class="tier-name">가격 2 (소팩 할인가)</span>
              </div>
              <div class="input-wrapper">
                <span class="currency-symbol">$</span>
                <input
                  type="number"
                  v-model.number="formPrices[1]"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="price-input"
                />
              </div>
            </div>

            <div class="tier-card" :class="{ 'is-empty': !formPrices[2] || formPrices[2] === 0 }">
              <div class="tier-header">
                <span class="tier-badge">3구간</span>
                <span class="tier-name">가격 3 (중팩 할인가)</span>
              </div>
              <div class="input-wrapper">
                <span class="currency-symbol">$</span>
                <input
                  type="number"
                  v-model.number="formPrices[2]"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="price-input"
                />
              </div>
            </div>

            <div class="tier-card box-tier" :class="{ 'is-empty': !formPrices[3] || formPrices[3] === 0 }">
              <div class="tier-header">
                <span class="tier-badge text-gold">4구간</span>
                <span class="tier-name">가격 4 (BOX 할인가 - {{ currentItem.custom_pack_qty || 96 }}개)</span>
              </div>
              <div class="input-wrapper">
                <span class="currency-symbol">$</span>
                <input
                  type="number"
                  v-model.number="formPrices[3]"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  class="price-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 푸터 -->
      <div class="modal-footer">
        <button class="btn-skip" @click="handleSkip">
          ⏩ 이 품목 건너뛰기 (Skip)
        </button>
        <div class="action-right">
          <button
            class="btn-save"
            :disabled="isSaving"
            @click="handleSaveAndNext"
          >
            <span v-if="isSaving">💾 저장 및 전파 중...</span>
            <span v-else>
              💾 저장 및 다음 품목 ({{ currentIndex + 1 }} / {{ items.length }})
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import frappeApi from '../../api/frappe.js'
import {
  saveBranchItemPrice,
  propagateGridPriceToFamily
} from '../../composables/usePriceTierEngine.js'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  items: {
    type: Array,
    default: () => []
  },
  branchName: {
    type: String,
    default: ''
  },
  rawItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'completed'])

const currentIndex = ref(0)
const isSaving = ref(false)
const formPrices = ref([0, 0, 0, 0])

const currentItem = computed(() => {
  if (!props.items || props.items.length === 0) return null
  return props.items[currentIndex.value] || null
})

watch(
  currentItem,
  (newItem) => {
    if (newItem && Array.isArray(newItem.prices)) {
      formPrices.value = [
        Number(newItem.prices[0] || 0),
        Number(newItem.prices[1] || 0),
        Number(newItem.prices[2] || 0),
        Number(newItem.prices[3] || 0)
      ]
    } else {
      formPrices.value = [0, 0, 0, 0]
    }
  },
  { immediate: true }
)

const closeModal = () => {
  emit('close')
}

const handleSkip = () => {
  if (currentIndex.value < props.items.length - 1) {
    currentIndex.value++
  } else {
    alert('모든 미완성 품목 확인이 완료되었습니다.')
    emit('completed')
    closeModal()
  }
}

const handleSaveAndNext = async () => {
  if (!currentItem.value) return
  isSaving.value = true

  const payload = {
    price_list_rate: Number(formPrices.value[0] || 0),
    custom_tier_2_price: Number(formPrices.value[1] || 0),
    custom_tier_3_price: Number(formPrices.value[2] || 0),
    custom_tier_4_price: Number(formPrices.value[3] || 0)
  }

  try {
    const isGrid = Boolean(currentItem.value.grid_group_id)

    if (isGrid) {
      // 그리드 품목 확인 질문
      const confirmPropagate = confirm(
        `[그리드 제품 자동 전파 확인]\n` +
        `'${currentItem.value.item_name}' 상품은 그리드 제품(그룹 ID: ${currentItem.value.grid_group_id})입니다.\n\n` +
        `다른 컬러 및 포장수량이 상이한 패밀리 제품에도 동일한 가격을 적용하시겠습니까?\n` +
        `(주의: 최신 입력값으로 패밀리 전체 단가가 덮어쓰기 됩니다.)`
      )

      if (confirmPropagate) {
        const count = await propagateGridPriceToFamily(
          props.branchName,
          currentItem.value.grid_group_id,
          payload,
          frappeApi,
          props.rawItems
        )
        alert(`그리드 패밀리 총 ${count}개 상품의 1~5단계 단가가 최신 가격으로 덮어쓰기 완료되었습니다.`)
      } else {
        await saveBranchItemPrice(
          props.branchName,
          currentItem.value.item_code,
          payload,
          frappeApi,
          currentItem.value.raw_item
        )
      }
    } else {
      await saveBranchItemPrice(
        props.branchName,
        currentItem.value.item_code,
        payload,
        frappeApi,
        currentItem.value.raw_item
      )
    }

    if (currentIndex.value < props.items.length - 1) {
      currentIndex.value++
    } else {
      alert('🎉 선택하신 미완성 품목들의 단가 등록이 모두 완료되었습니다!')
      emit('completed')
      closeModal()
    }
  } catch (err) {
    console.error('Save and next error:', err)
    alert('단가 저장 중 오류가 발생했습니다: ' + (err.message || err))
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  color: #f8fafc;
  font-family: 'Inter', -apple-system, sans-serif;
}

.modal-header {
  background: #1e293b;
  padding: 20px 24px;
  border-bottom: 1px solid #334155;
}

.header-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-title-row h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
}

.warn-badge {
  background-color: #f59e0b;
  color: #0f172a;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 6px;
}

.btn-close {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  cursor: pointer;
}
.btn-close:hover {
  color: #f8fafc;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #818cf8);
  transition: width 0.3s ease;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.item-info-banner {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item .label {
  font-size: 0.75rem;
  color: #94a3b8;
  text-transform: uppercase;
}

.info-item .val {
  font-size: 0.95rem;
}

.text-amber {
  color: #f59e0b;
  font-weight: 700;
}
.text-cyan {
  color: #38bdf8;
  font-weight: 700;
}
.text-orange {
  color: #fb923c;
  font-weight: 700;
}
.font-bold {
  font-weight: 700;
}

.tiers-input-section h4 {
  margin: 0 0 4px 0;
  font-size: 1.05rem;
  color: #e2e8f0;
}

.section-desc {
  margin: 0 0 16px 0;
  font-size: 0.85rem;
  color: #94a3b8;
}

.tiers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}

.tier-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s;
}

.tier-card.is-empty {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.05);
}

.tier-card.box-tier {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.05);
}

.tier-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tier-badge {
  font-size: 0.7rem;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
}

.tier-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e2e8f0;
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: #0f172a;
  border: 1px solid #475569;
  border-radius: 6px;
  padding: 0 8px;
}

.input-wrapper:focus-within {
  border-color: #38bdf8;
}

.currency-symbol {
  color: #94a3b8;
  font-size: 0.9rem;
  font-weight: 600;
  margin-right: 4px;
}

.price-input {
  background: transparent;
  border: none;
  color: #f8fafc;
  font-size: 1rem;
  font-weight: 700;
  width: 100%;
  padding: 8px 0;
  outline: none;
}

.modal-footer {
  background: #1e293b;
  padding: 16px 24px;
  border-top: 1px solid #334155;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-skip {
  background: transparent;
  border: 1px solid #475569;
  color: #cbd5e1;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-skip:hover {
  background: #334155;
  color: #f8fafc;
}

.btn-save {
  background: linear-gradient(135deg, #0284c7, #38bdf8);
  border: none;
  color: #ffffff;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
  transition: all 0.2s;
}
.btn-save:hover:not(:disabled) {
  background: linear-gradient(135deg, #0369a1, #0284c7);
  transform: translateY(-1px);
}
.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
