<template>
  <div class="mobile-inventory-view" style="display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: white;">
    <!-- 검색 영역 -->
    <div style="padding: 15px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; z-index: 10;">
      <div class="search-section dual-search" style="display: flex; gap: 10px; width: 100%;">
        <div class="search-box-wrapper" style="position: relative; flex: 1; display: flex; align-items: center;">
          <span class="search-icon" style="position: absolute; left: 12px; font-size: 14px; color: #94a3b8;">🔍</span>
          <input 
            type="text" 
            placeholder="상품명 또는 속성 검색..." 
            v-model="searchQuery"
            class="search-bar"
            style="width: 100%; padding: 12px 12px 12px 35px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none;"
          />
        </div>
        <div class="search-box-wrapper" style="position: relative; flex: 1; display: flex; align-items: center;">
          <span class="search-icon" style="position: absolute; left: 12px; font-size: 14px; color: #f59e0b;">🏷️</span>
          <input 
            type="text" 
            placeholder="바코드 스캔..." 
            v-model="barcodeQuery"
            class="search-bar barcode-bar"
            style="width: 100%; padding: 12px 12px 12px 35px; border: 1px solid #fcd34d; background: #fffbeb; border-radius: 8px; font-size: 14px; outline: none;"
          />
        </div>
      </div>
    </div>

    <!-- 결과 영역 -->
    <div style="flex: 1; overflow-y: auto;">
      <table class="inventory-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="width: 50%; background: #f1f5f9; padding: 12px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">상품 코드</th>
            <th style="width: 25%; background: #e0f2fe; padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #0284c7; font-size: 13px; position: sticky; top: 0; z-index: 2;">지점 ({{ authStore.user?.branch_name }})</th>
            <th style="width: 25%; background: #f1f5f9; padding: 12px 10px; text-align: center; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">메인 (ALARCON)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in displayedItems" :key="item.name" style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 15px 10px; word-break: break-all;">
              <strong style="font-size: 14px; color: #1e293b;">{{ item.name }}</strong><br/>
              <span style="font-size: 11px; color: #94a3b8;">{{ item.item_name }}</span>
            </td>
            <td style="padding: 15px 10px; vertical-align: middle; text-align: center;">
              <strong style="font-size: 15px; color: #0284c7;">{{ getStock(item.name, authStore.user?.branch_name) }}</strong>
            </td>
            <td style="padding: 15px 10px; vertical-align: middle; text-align: center;">
              <strong style="font-size: 15px; color: #334155;">{{ getStock(item.name, '[MAIN] ALARCON - K') }}</strong>
            </td>
          </tr>
          <tr v-if="listHasMore">
            <td colspan="3" style="text-align:center; padding: 20px; background:#fffbeb;">
              <button type="button" @click="loadMoreItems" style="background:#fef3c7;border:1px solid #f59e0b;color:#b45309;font-weight:bold;padding:12px 24px;border-radius:8px;cursor:pointer;width: 100%;font-size: 14px;">
                결과 더보기 (+{{ listRemaining }})
              </button>
            </td>
          </tr>
          <tr v-if="displayedItems.length === 0">
            <td colspan="3" style="text-align: center; padding: 60px 20px; color: #94a3b8; font-size: 15px;">
              검색 결과가 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../../../stores/auth.js'
import { useItemSearch } from '../../../composables/useItemSearch.js'

const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) }
})

const authStore = useAuthStore()
const { rebuildItemIndex, searchItemsOrAll } = useItemSearch()

const searchQuery = ref('')
const barcodeQuery = ref('')

const listPage = ref(1)
const itemsPerPage = 50

onMounted(() => {
  rebuildItemIndex(props.rawItems)
})

watch(() => props.rawItems, (newVal) => {
  rebuildItemIndex(newVal)
}, { deep: true })

const filteredItems = computed(() => {
  const q = barcodeQuery.value.trim() || searchQuery.value.trim()
  if (!q) return searchItemsOrAll('', { limit: null, allLimit: 99999 })
  return searchItemsOrAll(q, { limit: null, allLimit: 99999 })
})

const displayedItems = computed(() => {
  return filteredItems.value.slice(0, listPage.value * itemsPerPage)
})

const listHasMore = computed(() => {
  return filteredItems.value.length > listPage.value * itemsPerPage
})

const listRemaining = computed(() => {
  return filteredItems.value.length - (listPage.value * itemsPerPage)
})

const loadMoreItems = () => {
  listPage.value++
}

watch([searchQuery, barcodeQuery], () => {
  listPage.value = 1
})

const getStock = (itemCode, warehouse) => {
  if (!warehouse) return 0
  const actual = props.binData?.[itemCode]?.[warehouse] || 0
  const reserved = props.pendingReserved?.[warehouse]?.[itemCode] || 0
  return actual - reserved
}
</script>
