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
            placeholder="상품명 또는 속성 검색..." 
            class="search-input" 
          />
        </div>
        <button class="btn-refresh" @click="loadInventory">🔄 새로고침</button>
      </div>

      <div class="table-scroll">
        <table class="product-table">
          <thead>
            <tr>
              <!-- 지점 요청: 상품코드 숨김, 품명/카테고리/재고 위주 -->
              <th>품명 (상품명)</th>
              <th>카테고리</th>
              <th>컬러/속성</th>
              <th>팩 수량<br/>(Pack Qty)</th>
              <!-- 지점 재고 & 메인 재고 표시 -->
              <th class="stock-col highlight-branch">내 지점 재고<br/>({{ authStore.user?.branch_name }})</th>
              <th class="stock-col highlight-main">메인 재고<br/>([MAIN] ALARCON - K)</th>
              <th>상세 보기 / 주문</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.name" class="inventory-row">
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
                    상세 ➔
                  </button>
                  <button class="btn-order" @click="$emit('add-to-transfer', item.name)">
                    주문 ➕
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredItems.length === 0">
              <td colspan="6" class="empty-state">검색된 상품이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useItemSearch } from '../../composables/useItemSearch.js'

const authStore = useAuthStore()
const emit = defineEmits(['open-detail', 'handle-migration'])

const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) }
})

const searchQuery = ref('')
const { rebuildItemIndex, searchItemsOrAll } = useItemSearch()

watch(() => props.rawItems, (newVal) => {
  if (newVal && newVal.length > 0) {
    rebuildItemIndex(newVal)
  }
}, { immediate: true })

const filteredItems = computed(() => {
  return searchItemsOrAll(searchQuery.value, { limit: null, allLimit: 99999 })
})

const getStock = (itemCode, warehouse) => {
  if (!props.binData[itemCode] || !warehouse) return 0
  return props.binData[itemCode][warehouse] || 0
}

const loadInventory = () => {
  rebuildItemIndex(props.rawItems)
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

.table-container { flex: 1; display: flex; flex-direction: column; background: white; padding: 15px; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px; }
.filter-bar { display: flex; gap: 15px; margin-bottom: 15px; }
.search-wrapper { position: relative; flex: 1; max-width: 400px; display: flex; align-items: center; }
.search-icon { position: absolute; left: 12px; font-size: 14px; }
.search-input { width: 100%; padding: 10px 10px 10px 35px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; }
.search-input:focus { border-color: #00a896; }
.btn-refresh { padding: 10px 15px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569; }
.btn-refresh:hover { background: #f1f5f9; }

.table-scroll { flex: 1; overflow: auto; border: 1px solid #e2e8f0; border-radius: 6px; }
.product-table { width: 100%; border-collapse: collapse; text-align: left; }
.product-table th, .product-table td { border-bottom: 1px solid #e2e8f0; padding: 12px; font-size: 13.5px; vertical-align: middle; }
.product-table th { background: #f8fafc; font-weight: bold; position: sticky; top: 0; z-index: 10; color: #475569; }

.name-cell { font-weight: bold; color: #0f172a; }
.stock-col { text-align: center; }
.stock-cell { text-align: center; font-size: 15px; }
.highlight-branch { background: #f0fdf4 !important; color: #166534 !important; border-bottom: 2px solid #86efac; }
.highlight-main { background: #f8fafc !important; color: #334155 !important; border-bottom: 2px solid #cbd5e1; }
.branch-stock strong { color: #166534; font-size: 16px; }
.main-stock strong { color: #475569; font-size: 16px; }

.btn-detail { background: #00a896; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-detail:hover { background: #059669; }

.empty-state { text-align: center; padding: 40px; color: #64748b; font-size: 15px; }

/* 호버 반전 효과 */
.inventory-row { transition: background-color 0.15s ease, color 0.15s ease; }
.inventory-row:hover { background-color: #334155; color: #f8fafc; }
.inventory-row:hover .stock-cell strong { color: #38bdf8; }
.inventory-row:hover .name-cell { color: #ffffff; }
.inventory-row:hover td { border-color: #475569; }

.action-cell { min-width: 140px; }
.btn-order { background: #0f172a; color: white; border: none; padding: 6px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 12px; }
.btn-order:hover { background: #334155; transform: translateY(-1px); }
</style>
