<template>
  <div class="product-list-zone">
    <header class="page-header">
      <h2>📋 Product List & Inventory</h2>
      <div class="action-buttons">
        <button class="btn-action outline" @click="handleMigration">
          <span class="icon">📥</span> CSV Import
        </button>
        <button class="btn-action outline" @click="exportCSV">
          <span class="icon">📤</span> CSV Export
        </button>
        <button class="btn-action outline" @click="openBarcodeModal" :disabled="selectedItems.length === 0">
          <span class="icon">🖨️</span> Print Barcode ({{ selectedItems.length }})
        </button>
        <button class="btn-action primary" @click="isRegModalOpen = true">
          <span class="icon">➕</span> New Product
        </button>
      </div>
    </header>

    <section class="table-container">
      <div class="filter-bar">
        <div class="search-wrapper">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="🔍 Search by name, color, brand..." 
            class="search-input" 
          />
        </div>
        <button class="btn-refresh" @click="loadProducts" :disabled="isLoading">🔄 Refresh</button>
      </div>

      <div class="table-scroll">
        <table class="product-table">
          <thead>
            <tr>
              <th width="40"><input type="checkbox" @change="toggleSelectAll" :checked="isAllSelected" /></th>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Brand</th>
              <th>Color</th>
              <th>Pack Qty</th>
              <th class="align-right">Box Stock</th>
              <th class="align-right">Piece Stock</th>
              <th class="align-right">Total Pieces</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="9" class="empty-state">Loading data...</td>
            </tr>
            <tr v-else-if="filteredProducts.length === 0">
              <td colspan="9" class="empty-state">No product data available.</td>
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
              <td class="align-right font-bold bg-light">{{ item.actual_qty || 0 }} Pcs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Barcode Modal -->
    <BarcodePrintModal v-if="isBarcodeModalOpen" :selected-items="selectedItems" @close="isBarcodeModalOpen = false" />

    <!-- Product Registration Modal -->
    <ProductRegistrationModal v-if="isRegModalOpen" @close="isRegModalOpen = false" @saved="loadProducts" />

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

const loadProducts = async () => {
  isLoading.value = true
  selectedItems.value = []
  try {
    const [itemRes, binRes] = await Promise.all([
      frappeApi.get('/api/resource/Item', {
        params: { 
          fields: JSON.stringify(['name', 'item_code', 'item_name', 'brand', 'custom_color', 'custom_pack_qty']),
          limit_page_length: 500,
          order_by: 'creation desc'
        }
      }),
      frappeApi.get('/api/resource/Bin', {
        params: { 
          fields: JSON.stringify(['item_code', 'actual_qty']),
          limit_page_length: 0 
        }
      })
    ])
    
    const stockMap = {}
    if (binRes.data && binRes.data.data) {
      binRes.data.data.forEach(bin => {
        if (!stockMap[bin.item_code]) stockMap[bin.item_code] = 0
        stockMap[bin.item_code] += (Number(bin.actual_qty) || 0)
      })
    }
    
    const items = itemRes.data.data.map(item => {
      return {
        ...item,
        actual_qty: stockMap[item.item_code] || 0
      }
    })
    
    products.value = items
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

const calculateStock = (item) => {
  const total = item.actual_qty || 0
  const packQty = item.custom_pack_qty || 1
  return {
    boxes: Math.floor(total / packQty),
    eaches: total % packQty
  }
}

const filteredProducts = computed(() => {
  if (!searchQuery.value) return products.value
  const q = searchQuery.value.toLowerCase()
  return products.value.filter(p => 
    (p.item_name && p.item_name.toLowerCase().includes(q)) || 
    (p.custom_color && p.custom_color.toLowerCase().includes(q)) ||
    (p.brand && p.brand.toLowerCase().includes(q)) ||
    (p.item_code && p.item_code.toLowerCase().includes(q))
  )
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

const handleMigration = () => {
  fileInputRef.value?.click()
}

const processCsvFile = (e) => {
  const file = e.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (ev) => {
    try {
      isLoading.value = true
      const text = ev.target.result
      const rows = text.split('\n').map(r => r.trim()).filter(r => r)
      
      if (rows.length < 2) throw new Error("No data found in CSV.")
      
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',').map(c => c.trim())
        // 최소한 제품명(0), 컬러(1), 박스당낱개수량(5), 메이커(7) 컬럼이 존재할 수 있도록 길이 체크 완화
        if (cols.length < 8) continue
        
        const itemName = cols[0]
        const color = cols[1]
        const safetyStock = Number(cols[4]) || 0  // 인덱스 4: 안전재고
        const packQty = Number(cols[5]) || 1      // 인덱스 5: 박스당낱개수량
        const brandName = cols[7]                 // 인덱스 7: 메이커(브랜드)

        let finalItemCode = `${itemName}-${color}`
        if (packQty > 1) finalItemCode += `-${packQty}`

        try {
          await frappeApi.post('/api/resource/Brand', { brand: brandName })
        } catch (err) { }

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
        } catch (err) { }
      }
      
      alert("Migration (Import) completed successfully.")
      loadProducts()
    } catch (error) {
      alert("Error occurred during CSV processing.")
      console.error(error)
    } finally {
      isLoading.value = false
      e.target.value = ''
    }
  }
  reader.readAsText(file)
}

const exportCSV = () => {
  if (products.value.length === 0) {
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
    const totalQty = p.actual_qty || 0
    
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
</style>
