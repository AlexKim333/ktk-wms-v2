<template>
  <div class="modal-overlay" v-if="isOpen" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ $t('branch.transfer.modal_assign_title', { slot: slotIndex + 1 }) }}</h3>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="search-section">
        <input 
          type="text" 
          v-model="searchQuery" 
          :placeholder="$t('branch.inventory.ph_search', '품목명 / 코드 검색')" 
          class="search-bar" 
          autofocus 
        />
      </div>

      <div class="slot-item-list">
        <!-- 단일 핫키 상품 목록 -->
        <template v-if="!isGridMode">
          <div 
            v-for="item in filteredSingleItems" 
            :key="item.name" 
            class="slot-list-item" 
            @click="selectItem(item)"
          >
            <div class="item-desc">
              <strong>{{ item.item_name || item.name }}</strong> 
              <span class="color-badge">({{ item.custom_color || $t('common.default', 'Default') }})</span>
            </div>
            <div class="item-stock">{{ getFormattedStockFor(item) }}</div>
          </div>
        </template>

        <!-- 그리드 묶음 상품 목록 -->
        <template v-else>
          <div 
            v-for="group in filteredGridItems" 
            :key="group.id" 
            class="slot-list-item" 
            @click="selectItem(group)"
          >
            <div class="item-desc">
              <strong>{{ group.group_name }}</strong> 
              <span class="color-badge" style="color: #00a896;">({{ group.variants.length }} Colors)</span>
            </div>
          </div>
        </template>

        <!-- 결과가 없을 경우 -->
        <div v-if="( !isGridMode && filteredSingleItems.length === 0 ) || ( isGridMode && filteredGridItems.length === 0 )" class="empty-msg">
          {{ $t('branch.inventory.empty_msg', '조회된 품목이 없습니다.') }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-clear-slot" @click="handleClear">
          {{ $t('branch.transfer.btn_clear_slot', '슬롯 초기화 (제거)') }}
        </button>
        <button class="btn-cancel" @click="$emit('close')">
          {{ $t('common.cancel', '취소') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useItemSearch } from '../../composables/useItemSearch'

const { t } = useI18n()
const { rebuildItemIndex, searchItemsOrAll } = useItemSearch()

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  slotIndex: { type: Number, default: 0 },
  isGridMode: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'assign', 'clear'])

const searchQuery = ref('')

watch(() => props.items, (newVal) => {
  if (!props.isGridMode && newVal && newVal.length > 0) {
    rebuildItemIndex(newVal)
  }
}, { immediate: true })

watch(() => props.isOpen, (open) => {
  if (open) {
    searchQuery.value = ''
  }
})

const filteredSingleItems = computed(() => {
  if (props.isGridMode) return []
  return searchItemsOrAll(searchQuery.value, { limit: 100, allLimit: 200 })
})

const filteredGridItems = computed(() => {
  if (!props.isGridMode) return []
  if (!searchQuery.value.trim()) return props.items.slice(0, 50)
  const q = searchQuery.value.toLowerCase()
  return props.items.filter(g => 
    g.group_name?.toLowerCase().includes(q) || 
    g.id?.toLowerCase().includes(q)
  )
})

const getStock = (itemCode, warehouse) => {
  if (!warehouse) return 0
  const actual = Number(props.binData?.[itemCode]?.[warehouse] || 0)
  const reserved = Number(props.pendingReserved?.[warehouse]?.[itemCode] || 0)
  return actual - reserved
}

const getFormattedStockFor = (item) => {
  if (!item) return ''
  const availableQty = getStock(item.name, '[MAIN] ALARCON - K')
  const packQty = Number(item.custom_pack_qty || 1)
  const boxes = Math.floor(availableQty / packQty)
  const eaches = availableQty % packQty
  return `📦 ${boxes} Box / ${eaches} ${t('branch.transfer.lbl_unit_ea', 'EA')}`
}

const selectItem = (itemOrGroup) => {
  emit('assign', itemOrGroup)
}

const handleClear = () => {
  emit('clear')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999999;
  backdrop-filter: blur(4px);
}
.modal-content {
  background: white;
  width: 90%;
  max-width: 550px;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}
.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #64748b;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}
.close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.search-section {
  margin-bottom: 15px;
}
.search-bar {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.search-bar:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}
.slot-item-list {
  flex: 1;
  overflow-y: auto;
  max-height: 380px;
  border: 1px solid #f1f5f9;
  border-radius: 6px;
  margin-bottom: 15px;
}
.slot-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background-color 0.15s;
}
.slot-list-item:hover {
  background: #f8fafc;
}
.item-desc strong {
  color: #1e293b;
  font-size: 14px;
}
.color-badge {
  font-size: 12px;
  color: #64748b;
  margin-left: 4px;
}
.item-stock {
  font-size: 12px;
  color: #0284c7;
  font-weight: 600;
}
.empty-msg {
  padding: 30px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}
.modal-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.btn-clear-slot {
  flex: 1;
  padding: 11px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s;
}
.btn-clear-slot:hover {
  background: #fee2e2;
}
.btn-cancel {
  padding: 11px 20px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel:hover {
  background: #e2e8f0;
}
</style>
