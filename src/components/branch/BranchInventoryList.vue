<template>
  <div class="product-list-zone branch-inventory">
    <header class="page-header">
      <h2>📦 지점 재고 조회 ({{ authStore.user?.branch_name }})</h2>
      <div class="action-buttons">
        <button class="btn-action outline" @click="$emit('handle-migration')">
          <span class="icon">📤</span> CSV 업로드
        </button>
        <button class="btn-action outline" @click="exportCSV">
          <span class="icon">📥</span> CSV 다운로드
        </button>
      </div>
    </header>

    <section class="table-container">
      <div class="filter-bar">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="상품명 검색..." 
            class="search-input" 
          />
        </div>
        <button class="btn-refresh" @click="loadInventory">🔄 새로고침</button>
      </div>

      <div class="table-scroll">
        <table class="product-table">
          <thead>
            <tr>
              <th>품명 (상품명)</th>
              <th>카테고리</th>
              <th>컬러/속성</th>
              <th>팩 수량<br/>(Pack Qty)</th>
              <th class="stock-col highlight-branch">내 지점 재고<br/>({{ authStore.user?.branch_name }})</th>
              <th class="stock-col highlight-main">메인 재고<br/>([MAIN] ALARCON - K)</th>
              <th>상세 보기 / 주문</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in displayedItems" :key="item.name" class="inventory-row">
              <td class="name-cell">{{ item.item_name }}</td>
              <td>{{ item.item_group }}</td>
              <td>{{ item.custom_color || '-' }}</td>
              <td style="text-align: center; color: #64748b; font-weight: bold;">
                {{ item.custom_pack_qty || 1 }}
              </td>
              <td class="stock-cell branch-stock">
                <strong>{{ getStock(item.name, authStore.user?.branch_name) }}</strong>
              </td>
              <td class="stock-cell main-stock">
                <strong>{{ getStock(item.name, '[MAIN] ALARCON - K') }}</strong>
              </td>
              <td class="action-cell">
                <div style="display: flex; gap: 8px; justify-content: center;">
                    <button class="btn-detail" @click="$emit('open-detail', item.name)">
                      상세 정보
                    </button>
                    <button class="btn-order" @click="handleAddOrder(item)">
                      주문 ➕
                    </button>
                  </div>
              </td>
            </tr>
            <tr v-if="listHasMore">
              <td colspan="7" style="text-align:center; padding: 16px; background:#fffbeb;">
                <button type="button" class="btn-show-more" @click="loadMoreItems">
                  결과 더보기 (+{{ listRemaining }})
                </button>
              </td>
            </tr>
            <tr v-if="displayedItems.length === 0">
              <td colspan="7" class="empty-state">검색된 상품이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useItemSearch, rankItemNameMatches } from '../../composables/useItemSearch.js'
import { usePagedList } from '../../composables/usePagedList.js'

const authStore = useAuthStore()
const emit = defineEmits(['open-detail', 'handle-migration', 'add-to-transfer'])

const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) }
})

const searchQuery = ref('')
const { rebuildItemIndex, searchItemsOrAll } = useItemSearch()

watch(() => props.rawItems, (newVal) => {
  if (newVal && newVal.length > 0) {
    rebuildItemIndex(newVal)
  }
}, { immediate: true })

const filteredItems = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return searchItemsOrAll('', { limit: null, allLimit: 99999 })
  const hits = searchItemsOrAll(q, { limit: null, allLimit: 99999 })
  return rankItemNameMatches(hits, q)
})

const {
  visible: displayedItems,
  hasMore: listHasMore,
  remaining: listRemaining,
  loadMore: loadMoreItems,
  reset: resetListPage
} = usePagedList(filteredItems, 100)

watch(searchQuery, () => resetListPage())
watch(() => props.rawItems, () => resetListPage())

const getStock = (itemCode, warehouse) => {
  if (!warehouse) return 0
  const actual = (props.binData[itemCode] && props.binData[itemCode][warehouse]) || 0
  const reserved = (props.pendingReserved[warehouse] && props.pendingReserved[warehouse][itemCode]) || 0
  return actual - reserved
}

const handleAddOrder = (item) => {
  const mainStock = getStock(item.name, '[MAIN] ALARCON - K')
  if (mainStock <= 0) {
    alert('메인 창고([MAIN] ALARCON - K)에 해당 상품의 재고가 없습니다.\n주문을 추가할 수 없습니다.')
    return
  }
  emit('add-to-transfer', item.name)
}

const loadInventory = () => {
  rebuildItemIndex(props.rawItems)
  resetListPage()
}

const exportCSV = () => {
  if (filteredItems.value.length === 0) return
  
  const headers = ['품명(Item Name)', '카테고리(Item Group)', '컬러(Color)', '팩 수량(Pack Qty)', `지점재고(${authStore.user?.branch_name})`, '메인재고(ALARCON-K)']
  
  const rows = filteredItems.value.map(item => [
    `"${item.item_name || ''}"`,
    `"${item.item_group || ''}"`,
    `"${item.custom_color || ''}"`,
    item.custom_pack_qty || 1,
    getStock(item.name, authStore.user?.branch_name),
    getStock(item.name, '[MAIN] ALARCON - K')
  ])
  
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `branch_inventory_${new Date().toISOString().slice(0,10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<style scoped>
.branch-inventory { display: flex; flex-direction: column; height: 100%; font-family: var(--sans, sans-serif); background: #f8fafc; padding: 15px; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: white; border-radius: 8px 8px 0 0; border: 1px solid #e2e8f0; border-bottom: none; }
.page-header h2 { margin: 0; font-size: 20px; color: #0f172a; }
.action-buttons { display: flex; gap: 10px; }
.btn-action.outline { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 13px; }
.btn-action.outline:hover { background: #f8fafc; border-color: #94a3b8; }

.table-container { flex: 1; background: white; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; display: flex; flex-direction: column; overflow: hidden; }
.filter-bar { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: center; background: #fcfcfc; }
.search-wrapper { position: relative; flex: 1; }
.search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.search-input { width: 100%; padding: 10px 12px 10px 36px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.btn-refresh { background: white; border: 1px solid #cbd5e1; padding: 8px 14px; border-radius: 6px; font-weight: bold; color: #64748b; cursor: pointer; }
.table-scroll { flex: 1; overflow: auto; }
.product-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.product-table th { position: sticky; top: 0; background: #f1f5f9; padding: 10px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 12px; }
.product-table td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
.inventory-row:hover { background: #f8fafc; }
.name-cell { font-weight: bold; color: #1e293b; }
.stock-col { text-align: center !important; }
.stock-cell { text-align: center; }
.branch-stock { color: #0f766e; }
.main-stock { color: #0369a1; }
.highlight-branch { background: #ecfdf5 !important; }
.highlight-main { background: #e0f2fe !important; }
.btn-detail, .btn-order { border: 1px solid #cbd5e1; background: white; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; }
.btn-order { background: #00a896; color: white; border-color: #00a896; }
.empty-state { text-align: center; padding: 40px; color: #94a3b8; }
.btn-show-more { background: #fef3c7; border: 1px solid #f59e0b; color: #b45309; font-weight: bold; font-size: 13px; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
.btn-show-more:hover { background: #fde68a; }
</style>
