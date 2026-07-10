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
            <tr v-else v-for="item in filteredProducts" :key="item.name" :class="{ selected: selectedItems.includes(item.name) }">
              <td><input type="checkbox" :value="item.name" v-model="selectedItems" /></td>
              <td class="mono">{{ item.item_code }}</td>
              <td class="font-bold">{{ item.item_name }}</td>
              <td>{{ item.brand }}</td>
              <td>{{ item.custom_color || 'Standard' }}</td>
              <td>{{ item.custom_pack_qty || 1 }}</td>
              <td class="align-right font-bold text-teal">{{ calculateStock(item).boxes }} Box</td>
              <td class="align-right font-bold text-teal">{{ calculateStock(item).eaches }} Pcs</td>
              <td class="align-right font-bold bg-light">{{ getDisplayStock(item) }} Pcs</td>
            </tr>
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
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import ProductRegistrationModal from '@/components/ProductRegistrationModal.vue'
import BarcodePrintModal from '@/components/BarcodePrintModal.vue'

const frappeApi = axios.create({
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  withCredentials: true
})

const isLoading = ref(false)
const products = ref([])
const searchQuery = ref('')
const selectedItems = ref([])

const isBarcodeModalOpen = ref(false)
const isRegModalOpen = ref(false)
const isExcludeModalOpen = ref(false)

const rawItems = ref([])
const rawBins = ref([])
const rawWarehouses = ref([])

const selectedWarehouse = ref('All')
const excludedWarehouses = ref(JSON.parse(localStorage.getItem('wms_excluded_warehouses') || '[]'))

const saveExcluded = () => {
  localStorage.setItem('wms_excluded_warehouses', JSON.stringify(excludedWarehouses.value))
  // 제외 창고가 변경되었을 때 선택된 창고가 제외 목록에 들어갔다면 All로 변경
  if (selectedWarehouse.value !== 'All' && excludedWarehouses.value.includes(selectedWarehouse.value)) {
    selectedWarehouse.value = 'All'
  }
}

const availableWarehouses = computed(() => {
  return rawWarehouses.value.filter(wh => !excludedWarehouses.value.includes(wh.name))
})

const loadProducts = async () => {
  isLoading.value = true
  selectedItems.value = []
  try {
    const [itemRes, binRes, whRes] = await Promise.all([
      frappeApi.get('/api/resource/Item', {
        params: { 
          fields: JSON.stringify(['name', 'item_code', 'item_name', 'brand', 'custom_color', 'custom_pack_qty']),
          limit_page_length: 500,
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
          filters: JSON.stringify([['disabled', '=', 0]]),
          limit_page_length: 0
        }
      })
    ])
    
    rawItems.value = itemRes.data.data || []
    rawBins.value = binRes.data.data || []
    rawWarehouses.value = whRes.data.data || []
    
  } catch (err) {
    console.error('Error loading products:', err)
    alert('Failed to load product data.')
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
    if (excludedWarehouses.value.includes(bin.warehouse)) return; // 제외된 창고 재고 무시
    
    if (selectedWarehouse.value === 'All' || selectedWarehouse.value === bin.warehouse) {
      total += (Number(bin.actual_qty) || 0)
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
  let list = rawItems.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p => 
      (p.item_name && p.item_name.toLowerCase().includes(q)) || 
      (p.custom_color && p.custom_color.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.item_code && p.item_code.toLowerCase().includes(q))
    )
  }
  return list
})

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
        const binsRes = await frappeApi.get('/api/resource/Bin', { params: { filters: JSON.stringify([['warehouse', '=', selectedWarehouse.value]]), fields: JSON.stringify(['item_code', 'actual_qty']), limit_page_length: 0 } })
        if (binsRes.data && binsRes.data.data) {
          binsRes.data.data.forEach(b => { stockMap[b.item_code] = b.actual_qty || 0 })
        }
      } catch (err) {
        console.warn('기존 목록 가져오기 실패, 개별 검증으로 진행합니다.', err)
      }

      for (let i = 1; i < rows.length; i++) {
        migrationProgress.value = `데이터 처리 중... (${i} / ${rows.length - 1})`
        const cols = rows[i].split(',').map(c => c.trim())
        // 최소한 제품명(0), 컬러(1), 박스당낱개수량(5), 메이커(7) 컬럼이 존재할 수 있도록 길이 체크 완화
        if (cols.length < 8) continue
        
        const itemName = cols[0]
        const color = cols[1]
        const boxQty = Number(cols[2]) || 0       // 인덱스 2: 박스재고수량
        const pieceQty = Number(cols[3]) || 0     // 인덱스 3: 갯수재고수량
        const safetyStock = Number(cols[4]) || 0  // 인덱스 4: 안전재고
        const packQty = Number(cols[5]) || 1      // 인덱스 5: 박스당낱개수량
        const brandName = cols[7]                 // 인덱스 7: 메이커(브랜드)

        let finalItemCode = `${itemName}-${color}`
        if (packQty > 1) finalItemCode += `-${packQty}`

        // 총 재고 계산
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

        // 입고 (Material Receipt)
        for (let i = 0; i < receipts.length; i += chunkSize) {
          migrationProgress.value = `재고 입고 조정 중... (${currentStep++} / ${totalSteps})`
          const chunk = receipts.slice(i, i + chunkSize)
          await frappeApi.post('/api/resource/Stock Entry', {
            docstatus: 1,
            stock_entry_type: 'Material Receipt',
            items: chunk.map(c => ({ item_code: c.item_code, qty: c.qty, t_warehouse: c.t_warehouse, allow_zero_valuation_rate: 1 }))
          })
        }

        // 출고 (Material Issue)
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

      alert("Migration (Import & Initial Stock) completed successfully. 재고가 정확하게 동기화되었습니다.")
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
  
  // UTF-8 BOM 추가하여 엑셀에서 한글 등 다국어가 깨지지 않게 함
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
  csvContent += "Item Name,Color,Brand,Pack Qty,Total Stock\n"
  
  // 현재 필터링된 데이터(filteredProducts) 기준으로 내보내거나 전체(products)를 내보낼 수 있음
  // 여기서는 현재 필터링되어 화면에 보이는 데이터를 내보냄
  filteredProducts.value.forEach(p => {
    // 필드 내에 콤마가 있을 경우를 대비하여 따옴표 처리
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
  
  // 날짜 포맷 (예: product_export_20260703.csv)
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '')
  link.setAttribute("download", `product_export_${dateStr}.csv`)
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<style scoped>
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
  background: #00a896;
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
