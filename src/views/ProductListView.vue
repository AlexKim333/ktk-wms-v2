<template>
  <div class="product-list-zone">
    <header class="page-header">
      <h2>📋 {{ $t('product_list.title') }}</h2>
      <div class="action-buttons">
        <button class="btn-action outline" @click="handleMigration">
          <span class="icon">📥</span> {{ $t('common.csv_import') }}
        </button>
        <button class="btn-action outline" @click="exportCSV">
          <span class="icon">📤</span> {{ $t('common.csv_export') }}
        </button>
        <button class="btn-action outline" @click="openBarcodeModal" :disabled="selectedItems.length === 0">
          <span class="icon">🖨️</span> {{ $t('product_list.print_barcode', { count: selectedItems.length }) }}
        </button>
        <button class="btn-action primary" @click="isRegModalOpen = true">
          <span class="icon">➕</span> {{ $t('product_list.new_product') }}
        </button>
      </div>
    </header>

    <section class="table-container">
      <div class="filter-bar">
        <div class="search-wrapper">
          <input 
            type="text" 
            v-model="searchQuery" 
            :placeholder="$t('product_list.search_placeholder')" 
            class="search-input" 
          />
        </div>
        
        <div class="warehouse-filter-wrapper">
          <select v-model="selectedWarehouse" class="warehouse-select">
            <option value="All">{{ $t('product_list.all_warehouses') }}</option>
            <option v-for="wh in availableWarehouses" :key="wh.name" :value="wh.name">
              {{ wh.warehouse_name }}
            </option>
          </select>
          <button class="btn-action outline icon-only" @click="isExcludeModalOpen = true" :title="$t('product_list.exclude_wh_setting')">
            ⚙️
          </button>
        </div>

        <button class="btn-refresh" @click="loadProducts" :disabled="isLoading">🔄 {{ $t('common.refresh') }}</button>
      </div>

      <div class="table-scroll">
        <table class="product-table">
          <thead>
            <tr>
              <th width="40"><input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" /></th>
              <th>{{ $t('product_list.col_item_code') }}</th>
              <th>{{ $t('product_list.col_item_name') }}</th>
              <th>{{ $t('product_list.col_brand') }}</th>
              <th>{{ $t('product_list.col_color') }}</th>
              <th>{{ $t('product_list.col_pack_qty') }}</th>
              <th class="align-right">{{ $t('product_list.col_box_stock') }}</th>
              <th class="align-right">{{ $t('product_list.col_piece_stock') }}</th>
              <th class="align-right">{{ $t('product_list.col_total_pieces') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="9" class="empty-state">{{ $t('common.loading') }}</td>
            </tr>
            <tr v-else-if="filteredProducts.length === 0">
              <td colspan="9" class="empty-state">{{ $t('product_list.no_data') }}</td>
            </tr>
            <template v-else>
              <tr v-for="item in displayedProducts" :key="item.name" 
                  :class="{ selected: selectedItems.includes(item.name), 'clickable-row': true }"
                  @click="$emit('open-detail', item.name)">
                <td @click.stop><input type="checkbox" :value="item.name" v-model="selectedItems" /></td>
                <td class="mono">{{ item.item_code }}</td>
                <td class="font-bold">{{ item.item_name }}</td>
                <td>{{ item.brand }}</td>
                <td>{{ item.custom_color || 'Standard' }}</td>
                <td>{{ item.custom_pack_qty || 1 }}</td>
                <td class="align-right font-bold text-teal">{{ calculateStock(item).boxes }} Box</td>
                <td class="align-right font-bold text-teal">{{ calculateStock(item).eaches }} Pcs</td>
                <td class="align-right font-bold bg-light">{{ getDisplayStock(item) }} Pcs</td>
              </tr>
              <tr v-if="productListHasMore">
                <td colspan="9" class="show-more-cell">
                  <button type="button" class="btn-show-more" @click="loadMoreProducts">
                    {{ $t('common.show_more', { n: productListRemaining }) }}
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Barcode Modal -->
    <BarcodePrintModal v-if="isBarcodeModalOpen" :selected-items="selectedItems" @close="isBarcodeModalOpen = false" />

    <!-- Product Registration Modal -->
    <ProductRegistrationModal v-if="isRegModalOpen" @close="isRegModalOpen = false" @saved="loadProducts" />

    <!-- Exclude Warehouses Modal -->
    <div class="modal-overlay" v-if="isExcludeModalOpen">
      <div class="modal-content exclude-modal">
        <div class="modal-header">
          <h3>⚙️ {{ $t('product_list.exclude_modal_title') }}</h3>
        </div>
        <div class="modal-body">
          <p class="text-sm text-gray mb-3">{{ $t('product_list.exclude_modal_desc') }}</p>
          <div class="warehouse-checklist">
            <label v-for="wh in rawWarehouses" :key="wh.name" class="check-label">
              <input type="checkbox" :value="wh.name" v-model="excludedWarehouses" @change="saveExcluded" />
              {{ wh.warehouse_name }}
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-action primary" @click="isExcludeModalOpen = false">{{ $t('common.done') }}</button>
        </div>
      </div>
    </div>

    <!-- Migration Loading Overlay -->
    <div class="modal-overlay" v-if="migrationProgress" style="z-index: 9999; flex-direction: column;">
      <div class="spinner" style="width: 50px; height: 50px; border-width: 5px; border-top-color: white;"></div>
      <div style="margin-top: 20px; font-weight: bold; font-size: 1.2rem; color: white;">
        {{ migrationProgress }}
      </div>
    </div>

    <!-- Hidden CSV File Input -->
    <input type="file" ref="fileInputRef" accept=".csv" style="display: none" @change="processCsvFile" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { createFlexSearcher, rankItemNameMatches } from '../composables/useItemSearch.js'
import { usePagedList } from '../composables/usePagedList.js'
import { usePendingReservations } from '../composables/usePendingReservations.js'
import axios from 'axios'
import BarcodePrintModal from '../components/BarcodePrintModal.vue'
import ProductRegistrationModal from '../components/ProductRegistrationModal.vue'

const emit = defineEmits(['open-detail'])

const router = useRouter()
const authStore = useAuthStore()

/** 품명(item_name)만 검색 — POS와 동일 정책 */
const productSearcher = createFlexSearcher({
  idField: 'name',
  indexFields: ['item_name'],
  toDoc: (item) => ({
    name: item.name,
    item_name: item.item_name || ''
  })
})

const frappeApi = axios.create({
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  withCredentials: true
})

const isLoading = ref(false)
const products = ref([])
const searchQuery = ref('')
const selectedItems = ref([])

const isAdmin = computed(() => authStore.isAdmin)
const userBranch = computed(() => authStore.user?.branch_name || '')

const isBarcodeModalOpen = ref(false)
const isRegModalOpen = ref(false)
const isExcludeModalOpen = ref(false)

const rawItems = ref([])
const rawBins = ref([])
const rawWarehouses = ref([])

const { fetchPendingReservations, getAvailableStock } = usePendingReservations()

const selectedWarehouse = ref('All')
const excludedWarehouses = ref(JSON.parse(localStorage.getItem('wms_excluded_warehouses') || '[]'))

const saveExcluded = () => {
  localStorage.setItem('wms_excluded_warehouses', JSON.stringify(excludedWarehouses.value))
  if (selectedWarehouse.value !== 'All' && excludedWarehouses.value.includes(selectedWarehouse.value)) {
    selectedWarehouse.value = 'All'
  }
}

const availableWarehouses = computed(() => {
  let list = rawWarehouses.value
  
  if (!isAdmin.value) {
    const branch = (userBranch.value || '').toUpperCase()
    list = list.filter(wh => {
      const wName = wh.name.toUpperCase()
      return wName.includes('ALARCON') || (branch && wName === branch)
    })
  }

  return list.filter(wh => !excludedWarehouses.value.includes(wh.name))
})

const loadProducts = async () => {
  isLoading.value = true
  selectedItems.value = []
  try {
    const [itemRes, binRes, whRes] = await Promise.all([
      frappeApi.get('/api/resource/Item', {
        params: { 
          fields: JSON.stringify(['name', 'item_code', 'item_name', 'brand', 'custom_color', 'custom_pack_qty']),
          limit_page_length: 0,
          order_by: 'creation desc'
        }
      }),
      frappeApi.get('/api/resource/Bin', {
        params: { 
          fields: JSON.stringify(['item_code', 'actual_qty', 'warehouse']),
          limit_page_length: 0 
        }
      }),
      frappeApi.get('/api/resource/Warehouse', {
        params: { 
          fields: JSON.stringify(['name', 'warehouse_name']),
          
          limit_page_length: 0
        }
      })
    ])
    
    rawItems.value = itemRes.data.data || []
    rawBins.value = binRes.data.data || []
    rawWarehouses.value = whRes.data.data || []
    productSearcher.rebuild(rawItems.value)
    
    await fetchPendingReservations()
    
  } catch (err) {
    console.error('Error loading products:', err)
    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
      alert('세션이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요.')
      authStore.logout()
      router.push('/login')
    } else {
      alert(`Failed to load product data: ${err.message || err}`)
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadProducts()
})

const getDisplayStock = (item) => {
  let total = 0
  const itemBins = rawBins.value.filter(b => b.item_code === item.name)
  
  itemBins.forEach(bin => {
    if (excludedWarehouses.value.includes(bin.warehouse)) return;
    
    if (!isAdmin.value) {
      const wName = bin.warehouse.toUpperCase()
      const branch = (userBranch.value || '').toUpperCase()
      if (!wName.includes('ALARCON') && (!branch || wName !== branch)) {
        return;
      }
    }
    
    if (selectedWarehouse.value === 'All' || selectedWarehouse.value === bin.warehouse) {
      const available = getAvailableStock(bin.item_code, bin.warehouse, Number(bin.actual_qty) || 0)
      total += available
    }
  })
  return total
}

const calculateStock = (item) => {
  const total = getDisplayStock(item)
  const packQty = item.custom_pack_qty || 1
  return {
    boxes: Math.floor(total / packQty),
    eaches: total % packQty
  }
}

const filteredProducts = computed(() => {
  // 검색어 없으면 전체 / 있으면 품명만 매칭 후 관련도 정렬
  if (!searchQuery.value.trim()) return rawItems.value
  const hits = productSearcher.search(searchQuery.value, { limit: null })
  const hitSet = new Set(hits.map((p) => p.name))
  const matched = rawItems.value.filter((p) => hitSet.has(p.name))
  return rankItemNameMatches(matched, searchQuery.value)
})

const {
  visible: displayedProducts,
  hasMore: productListHasMore,
  remaining: productListRemaining,
  loadMore: loadMoreProducts,
  reset: resetProductListPage
} = usePagedList(filteredProducts, 100)

watch(searchQuery, () => resetProductListPage())
watch(rawItems, () => resetProductListPage())

const isAllSelected = computed(() => {
  return filteredProducts.value.length > 0 && selectedItems.value.length === filteredProducts.value.length
})

const toggleSelectAll = (e) => {
  if (e.target.checked) {
    selectedItems.value = filteredProducts.value.map(p => p.name)
  } else {
    selectedItems.value = []
  }
}

const openBarcodeModal = () => {
  isBarcodeModalOpen.value = true
}

const fileInputRef = ref(null)
const migrationProgress = ref('')

const handleMigration = () => {
  fileInputRef.value?.click()
}

const processCsvFile = (e) => {
  if (selectedWarehouse.value === 'All') {
    alert("기초재고를 입고할 특정 창고를 선택한 후 다시 시도해주세요.")
    e.target.value = ''
    return
  }

  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      isLoading.value = true
      const text = ev.target.result
      const rows = text.split('\n').map(r => r.trim()).filter(r => r)
      
      if (rows.length < 2) throw new Error("No data found in CSV.")
      
      const stockEntryItems = []
      
      migrationProgress.value = '기존 품목 및 브랜드 정보 가져오는 중...'
      let existingBrands = new Set()
      let existingItems = new Set()
      let stockMap = {}
      try {
        const brandsRes = await frappeApi.get('/api/resource/Brand', { params: { fields: JSON.stringify(['name']), limit_page_length: 0 } })
        if (brandsRes.data && brandsRes.data.data) {
          existingBrands = new Set(brandsRes.data.data.map(b => b.name))
        }
        const itemsRes = await frappeApi.get('/api/resource/Item', { params: { fields: JSON.stringify(['name']), limit_page_length: 0 } })
        if (itemsRes.data && itemsRes.data.data) {
          existingItems = new Set(itemsRes.data.data.map(i => i.name))
        }
        const binsRes = await frappeApi.get('/api/resource/Bin', { params: { filters: JSON.stringify([['warehouse', '=', selectedWarehouse.value]]), fields: JSON.stringify(['item_code', 'actual_qty', 'warehouse']), limit_page_length: 0 } })
        if (binsRes.data && binsRes.data.data) {
          binsRes.data.data.forEach(b => { 
            const actual = b.actual_qty || 0
            stockMap[b.item_code] = getAvailableStock(b.item_code, b.warehouse, actual) 
          })
        }
      } catch (err) {
        console.warn('기존 목록 가져오기 실패, 개별 검증으로 진행합니다.', err)
      }

      for (let i = 1; i < rows.length; i++) {
        migrationProgress.value = `데이터 처리 중... (${i} / ${rows.length - 1})`
        const cols = rows[i].split(',').map(c => c.trim())
        if (cols.length < 8) continue
        
        const itemName = cols[0]
        const color = cols[1]
        const boxQty = Number(cols[2]) || 0
        const pieceQty = Number(cols[3]) || 0
        const safetyStock = Number(cols[4]) || 0
        const packQty = Number(cols[5]) || 1
        const brandName = cols[7]

        let finalItemCode = `${itemName}-${color}`
        if (packQty > 1) finalItemCode += `-${packQty}`

        const totalQty = (boxQty * packQty) + pieceQty

        if (brandName && !existingBrands.has(brandName)) {
          try {
            await frappeApi.post('/api/resource/Brand', { brand: brandName })
            existingBrands.add(brandName)
          } catch (err) { }
        }

        if (finalItemCode && !existingItems.has(finalItemCode)) {
          try {
            await frappeApi.post('/api/resource/Item', {
              item_code: finalItemCode,
              item_name: itemName,
              item_group: 'Products',
              brand: brandName,
              stock_uom: 'Nos',
              is_stock_item: 1,
              custom_color: color,
              custom_pack_qty: packQty,
              safety_stock: safetyStock
            })
            existingItems.add(finalItemCode)
          } catch (err) { }
        }

        if (totalQty >= 0) {
          const currentQty = stockMap[finalItemCode] || 0
          const diff = totalQty - currentQty

          if (diff > 0) {
            stockEntryItems.push({
              type: 'Material Receipt',
              item_code: finalItemCode,
              qty: diff,
              t_warehouse: selectedWarehouse.value,
              allow_zero_valuation_rate: 1
            })
          } else if (diff < 0) {
            stockEntryItems.push({
              type: 'Material Issue',
              item_code: finalItemCode,
              qty: Math.abs(diff),
              s_warehouse: selectedWarehouse.value,
              allow_zero_valuation_rate: 1
            })
          }
        }
      }
      
      if (stockEntryItems.length > 0) {
        const receipts = stockEntryItems.filter(i => i.type === 'Material Receipt')
        const issues = stockEntryItems.filter(i => i.type === 'Material Issue')

        const chunkSize = 200
        let currentStep = 1
        const totalSteps = Math.ceil(receipts.length / chunkSize) + Math.ceil(issues.length / chunkSize)

        for (let i = 0; i < receipts.length; i += chunkSize) {
          migrationProgress.value = `재고 입고 조정 중... (${currentStep++} / ${totalSteps})`
          const chunk = receipts.slice(i, i + chunkSize)
          await frappeApi.post('/api/resource/Stock Entry', {
            docstatus: 1,
            stock_entry_type: 'Material Receipt',
            items: chunk.map(c => ({ item_code: c.item_code, qty: c.qty, t_warehouse: c.t_warehouse, allow_zero_valuation_rate: 1 }))
          })
        }

        for (let i = 0; i < issues.length; i += chunkSize) {
          migrationProgress.value = `재고 출고 조정 중... (${currentStep++} / ${totalSteps})`
          const chunk = issues.slice(i, i + chunkSize)
          await frappeApi.post('/api/resource/Stock Entry', {
            docstatus: 1,
            stock_entry_type: 'Material Issue',
            items: chunk.map(c => ({ item_code: c.item_code, qty: c.qty, s_warehouse: c.s_warehouse, allow_zero_valuation_rate: 1 }))
          })
        }
      }

      alert("Migration (Import & Initial Stock) completed successfully.")
      loadProducts()
    } catch (error) {
      alert("Error occurred during CSV processing. " + error.message)
      console.error(error)
    } finally {
      isLoading.value = false
      migrationProgress.value = ''
      e.target.value = ''
    }
  }
  reader.readAsText(file)
}

const exportCSV = () => {
  if (filteredProducts.value.length === 0) {
    alert("No data to export.")
    return
  }
  
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
  csvContent += "Item Name,Color,Brand,Pack Qty,Total Stock\n"
  
  filteredProducts.value.forEach(p => {
    const name = `"${p.item_name ? p.item_name.replace(/"/g, '""') : ''}"`
    const color = `"${p.custom_color ? p.custom_color.replace(/"/g, '""') : 'Standard'}"`
    const brand = `"${p.brand ? p.brand.replace(/"/g, '""') : ''}"`
    const packQty = p.custom_pack_qty || 1
    const totalQty = getDisplayStock(p)
    
    csvContent += `${name},${color},${brand},${packQty},${totalQty}\n`
  })
  
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement("a")
  link.setAttribute("href", encodedUri)
  
  const dateStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0].replace(/-/g, '')
  link.setAttribute("download", `product_export_${dateStr}.csv`)
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<style scoped>
:root {
  --neon-teal: #00a896;
}

.clickable-row {
  cursor: pointer;
  transition: background-color 0.2s;
}
.clickable-row:hover {
  background-color: #f1f5f9;
}

.product-list-zone {
  flex: 1;
  padding: 24px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 22px;
  color: #1e293b;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-action.outline {
  background: white;
  border: 1px solid #cbd5e1;
  color: #475569;
}
.btn-action.outline:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.btn-action.outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-action.primary {
  border: 1px solid #00a896;
  color: white;
}
.btn-action.primary:hover {
  background: #028d7e;
}

.table-container {
  flex: 1;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.filter-bar {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  background: #fcfcfc;
}

.search-input {
  width: 320px;
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}
.search-input:focus {
  border-color: #00a896;
  box-shadow: 0 0 0 3px rgba(0, 168, 150, 0.1);
}

.btn-refresh {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: bold;
  color: #64748b;
  cursor: pointer;
}
.btn-refresh:hover:not(:disabled) {
  background: #f1f5f9;
}

.table-scroll {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.product-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.product-table th, .product-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}

.product-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 0 #e2e8f0;
}

.product-table tr:hover {
  background: #f8fafc;
}
.product-table tr.selected {
  background: #f0fdfa; /* 옅은 민트색 */
}

.mono { font-family: monospace; color: #64748b; font-size: 13px; }
.font-bold { font-weight: bold; color: #1e293b; }
.text-teal { color: #0f766e; }
.align-right { text-align: right !important; }
.bg-light { background: #f1f5f9; }

.empty-state {
  padding: 60px 0 !important;
  text-align: center !important;
  color: #94a3b8;
  font-size: 14px;
}

.show-more-cell {
  text-align: center !important;
  padding: 16px !important;
  background: #fffbeb;
  border-top: 1px solid #fde68a;
}

.btn-show-more {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  color: #b45309;
  font-weight: bold;
  font-size: 13px;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
}
.btn-show-more:hover {
  background: #fde68a;
}

.warehouse-filter-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}
.warehouse-select {
  padding: 10px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  min-width: 200px;
  background: white;
}
.warehouse-select:focus {
  border-color: #00a896;
}
.icon-only {
  padding: 10px;
  font-size: 16px;
}
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;
}
.modal-content.exclude-modal {
  background: white; width: 400px; padding: 25px; border-radius: 8px;
}
.modal-header h3 { margin: 0 0 10px 0; font-size: 18px; color: #1e293b; }
.text-sm { font-size: 13px; }
.text-gray { color: #64748b; }
.mb-3 { margin-bottom: 15px; }
.warehouse-checklist {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  padding: 10px;
  border-radius: 6px;
}
.check-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
}
.modal-footer {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
