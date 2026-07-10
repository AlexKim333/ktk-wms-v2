<template>
  <div class="adj-detail-container">
    <div class="header-nav">
      <button class="back-btn" @click="$emit('go-back')">←</button>
      <h2>{{ isDraft ? `${$t('stock_adj.detail_draft_prefix')}${adjustmentId}` : $t('stock_adj.detail_new') }}</h2>
      <span v-if="isDraft" class="draft-badge">{{ $t('stock_adj.status_draft') }}</span>
    </div>

    <div class="content-layout">
      <!-- Left Area: Items -->
      <div class="left-panel">
        <div class="panel-card search-card">
          <label>{{ $t('stock_adj.detail_products_label') }}</label>
          <div class="search-input-wrapper">
            <span class="icon">🔍</span>
            <input 
              type="text" 
              v-model="searchQuery" 
              :placeholder="$t('stock_adj.detail_search_placeholder')" 
              @focus="isDropdownOpen = true"
            />
            <span class="icon scanner-icon">🎫</span>
            
            <!-- Search Dropdown -->
            <div v-if="isDropdownOpen && filteredItems.length > 0" class="search-dropdown">
              <div 
                v-for="item in filteredItems" 
                :key="item.name"
                class="dropdown-item"
                @click="addItemToAdjustment(item)"
              >
                <div class="item-img-placeholder">📷</div>
                <div class="item-info">
                  <div class="item-name">{{ item.item_name }}</div>
                  <div class="item-color">{{ item.custom_color || $t('stock_adj.detail_default_color') }} · {{ $t('stock_adj.detail_pack') }}: {{ item.custom_pack_qty || 1 }}</div>
                </div>
                <div class="item-stock-badge">
                  {{ getBinStock(item.name) }} {{ $t('stock_adj.detail_units') }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card items-card">
          <div class="items-table-wrapper">
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 35%">{{ $t('stock_adj.col_product') }}</th>
                  <th style="width: 15%">{{ $t('stock_adj.col_sys_stock') }}</th>
                  <th style="width: 20%">{{ $t('stock_adj.col_phys_qty') }}</th>
                  <th style="width: 15%">{{ $t('stock_adj.col_unit_cost') }}</th>
                  <th style="width: 10%">{{ $t('stock_adj.col_diff') }}</th>
                  <th style="width: 5%"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in adjustmentItems" :key="idx">
                  <td>
                    <div class="product-cell">
                      <div class="img-placeholder">📷</div>
                      <div>
                        <div class="font-bold">{{ row.item_name }}</div>
                        <div class="text-sm text-gray">{{ row.item_code }} ({{ $t('stock_adj.detail_pack') }}: {{ row.pack_qty }})</div>
                      </div>
                    </div>
                  </td>
                  <td class="text-center font-bold text-gray">
                    {{ row.system_qty }}
                  </td>
                  <td>
                    <div class="qty-inputs">
                      <input type="number" v-model.number="row.input_box" :placeholder="$t('stock_adj.box')" class="qty-box" />
                      <span>+</span>
                      <input type="number" v-model.number="row.input_each" :placeholder="$t('stock_adj.pcs')" class="qty-each" />
                    </div>
                  </td>
                  <td>
                    <input type="number" v-model.number="row.unit_cost" placeholder="0" class="qty-each cost-input" />
                  </td>
                  <td class="text-center font-bold" :class="diffClass(row)">
                    {{ calculateDiff(row) > 0 ? '+' : '' }}{{ calculateDiff(row) }}
                  </td>
                  <td class="text-center">
                    <button class="btn-delete" @click="removeItem(idx)" :title="$t('stock_adj.btn_remove_title')">🗑️</button>
                  </td>
                </tr>
                <tr v-if="adjustmentItems.length === 0">
                  <td colspan="6" class="empty-state">{{ $t('stock_adj.empty_detail') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="panel-card summary-card">
          <div class="summary-item">
            <span class="label">{{ $t('stock_adj.summary_total_products') }}</span>
            <span class="value">{{ adjustmentItems.length }}</span>
          </div>
          <div class="summary-item">
            <span class="label">{{ $t('stock_adj.summary_total_qty') }}</span>
            <span class="value">{{ totalPhysicalQty }}</span>
          </div>
          <div class="summary-item">
            <span class="label">{{ $t('stock_adj.summary_net_diff') }}</span>
            <span class="value" :class="totalDiff > 0 ? 'text-green' : (totalDiff < 0 ? 'text-red' : '')">
              {{ totalDiff > 0 ? '+' : '' }}{{ totalDiff }}
            </span>
          </div>
        </div>
      </div>

      <!-- Right Area: Settings -->
      <div class="right-panel">
        <div class="panel-card settings-card">
          
          <div class="form-group">
            <label>{{ $t('stock_adj.label_destination') }}</label>
            <select v-model="selectedWarehouse" @change="fetchBinData">
              <option disabled value="">{{ $t('stock_adj.placeholder_location') }}</option>
              <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">
                {{ wh.warehouse_name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>{{ $t('stock_adj.label_reason') }}</label>
            <select v-model="selectedReason">
              <option disabled value="">{{ $t('stock_adj.placeholder_reason') }}</option>
              <option value="Stock Reconciliation">{{ $t('stock_adj.reason_correction') }}</option>
              <option value="Damage">{{ $t('stock_adj.reason_damage') }}</option>
              <option value="Theft">{{ $t('stock_adj.reason_theft') }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="flex-between">
              {{ $t('stock_adj.label_notes') }} <span class="icon">✏️</span>
            </label>
            <textarea v-model="notes" :placeholder="$t('stock_adj.placeholder_notes')" rows="4"></textarea>
          </div>

        </div>
      </div>
    </div>

    <div class="bottom-actions">
      <button class="btn-cancel" @click="$emit('go-back')">{{ $t('stock_adj.btn_cancel') }}</button>
      <button class="btn-draft" @click="saveAdjustment(0)">{{ $t('stock_adj.btn_save_draft') }}</button>
      <button class="btn-confirm" @click="saveAdjustment(1)">{{ $t('stock_adj.btn_confirm') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  adjustmentId: {
    type: String,
    default: null
  }
})
const emit = defineEmits(['go-back', 'saved'])

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const isDraft = computed(() => !!props.adjustmentId)

// State
const searchQuery = ref('')
const isDropdownOpen = ref(false)
const selectedWarehouse = ref('')
const selectedReason = ref('Stock Reconciliation')
const notes = ref('')

const allItems = ref([])
const binData = ref({}) // { item_code: qty }
const warehouseList = ref([])
const adjustmentItems = ref([]) // cart

const fetchInitialData = async () => {
  try {
    // 1. Fetch Warehouses
    const whRes = await frappeApi.get('/api/resource/Warehouse', {
      params: { 
        fields: JSON.stringify(['name', 'warehouse_name']),
        filters: JSON.stringify([['disabled', '=', 0]]),
        limit_page_length: 0
      }
    })
    warehouseList.value = whRes.data.data

    // 2. Fetch Items
    const itemRes = await frappeApi.get('/api/resource/Item', {
      params: {
        fields: JSON.stringify(['name', 'item_name', 'custom_color', 'custom_pack_qty']),
        limit_page_length: 500
      }
    })
    allItems.value = itemRes.data.data

    // 3. If editing draft, fetch draft details
    if (isDraft.value) {
      const draftRes = await frappeApi.get(`/api/resource/Stock Reconciliation/${props.adjustmentId}`)
      const doc = draftRes.data.data
      selectedReason.value = doc.purpose
      // In Frappe Stock Recon, warehouse might be on item level or global. We will assume global for UI simplicity.
      if (doc.items && doc.items.length > 0) {
        selectedWarehouse.value = doc.items[0].warehouse
        await fetchBinData() // Fetch bin data for this warehouse
        
        adjustmentItems.value = doc.items.map(row => {
          const matchedItem = allItems.value.find(i => i.name === row.item_code)
          const packQty = matchedItem ? (matchedItem.custom_pack_qty || 1) : 1
          return {
            item_code: row.item_code,
            item_name: matchedItem ? matchedItem.item_name : row.item_code,
            pack_qty: packQty,
            system_qty: row.current_qty || 0,
            input_box: 0,
            input_each: row.qty, // Map full physical qty to 'each' initially
            unit_cost: row.valuation_rate || 0
          }
        })
      }
    }

  } catch (error) {
    console.error('Initial data fetch error:', error)
  }
}

const fetchBinData = async () => {
  if (!selectedWarehouse.value) {
    binData.value = {}
    return
  }
  try {
    // Fetch Bin quantities for selected warehouse
    const binRes = await frappeApi.get('/api/resource/Bin', {
      params: {
        filters: JSON.stringify([['warehouse', '=', selectedWarehouse.value]]),
        fields: JSON.stringify(['item_code', 'actual_qty']),
        limit_page_length: 1000
      }
    })
    const bins = {}
    binRes.data.data.forEach(b => {
      bins[b.item_code] = b.actual_qty
    })
    binData.value = bins

    // Update system_qty in current cart
    adjustmentItems.value.forEach(row => {
      row.system_qty = bins[row.item_code] || 0
    })

  } catch (error) {
    console.error('Bin fetch error:', error)
  }
}

onMounted(() => {
  fetchInitialData()
  document.addEventListener('click', closeDropdown)
})
onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})

const closeDropdown = (e) => {
  if (!e.target.closest('.search-input-wrapper')) {
    isDropdownOpen.value = false
  }
}

const filteredItems = computed(() => {
  if (!searchQuery.value) return allItems.value.slice(0, 10) // 빈 검색어일 때 최상위 10개 표시
  const q = searchQuery.value.toLowerCase()
  return allItems.value.filter(i => 
    i.item_name.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
  ).slice(0, 10) // 검색 시에도 10개로 넉넉히 표시
})

const getBinStock = (itemCode) => {
  return binData.value[itemCode] || 0
}

const addItemToAdjustment = (item) => {
  if (!selectedWarehouse.value) {
    alert('Please select a Destination (Warehouse) first.')
    return
  }
  
  const existing = adjustmentItems.value.find(row => row.item_code === item.name)
  if (!existing) {
    adjustmentItems.value.push({
      item_code: item.name,
      item_name: item.item_name,
      pack_qty: item.custom_pack_qty || 1,
      system_qty: getBinStock(item.name),
      input_box: 0,
      input_each: 0,
      unit_cost: 0
    })
  }
  searchQuery.value = ''
  isDropdownOpen.value = false
}

const removeItem = (index) => {
  adjustmentItems.value.splice(index, 1)
}

const calculatePhysicalQty = (row) => {
  return (Number(row.input_box) * row.pack_qty) + Number(row.input_each)
}

const calculateDiff = (row) => {
  return calculatePhysicalQty(row) - row.system_qty
}

const diffClass = (row) => {
  const diff = calculateDiff(row)
  if (diff > 0) return 'text-green'
  if (diff < 0) return 'text-red'
  return 'text-gray'
}

const totalPhysicalQty = computed(() => {
  return adjustmentItems.value.reduce((sum, row) => sum + calculatePhysicalQty(row), 0)
})

const totalDiff = computed(() => {
  return adjustmentItems.value.reduce((sum, row) => sum + calculateDiff(row), 0)
})

// Submit to Frappe
const saveAdjustment = async (docstatus) => {
  if (!selectedWarehouse.value) {
    alert("Please select a Destination Warehouse.")
    return
  }
  if (adjustmentItems.value.length === 0) {
    alert("Please add products to adjust.")
    return
  }

  const payload = {
    purpose: selectedReason.value,
    set_posting_time: 1,
    items: adjustmentItems.value.map(row => {
      const payloadItem = {
        item_code: row.item_code,
        warehouse: selectedWarehouse.value,
        qty: calculatePhysicalQty(row)
      };
      // Diff가 플러스이면서 단가가 입력된 경우에만 valuation_rate를 전송 (에러 방지)
      if (calculateDiff(row) > 0 && row.unit_cost > 0) {
        payloadItem.valuation_rate = row.unit_cost;
      }
      return payloadItem;
    })
  }

  try {
    let docName = props.adjustmentId;

    if (isDraft.value) {
      // 1. 기존 Draft 업데이트
      await frappeApi.put(`/api/resource/Stock Reconciliation/${docName}`, payload)
    } else {
      // 1. 신규 Draft 생성 (docstatus: 0으로 무조건 먼저 생성)
      const createPayload = { ...payload, docstatus: 0 }
      const res = await frappeApi.post('/api/resource/Stock Reconciliation', createPayload)
      docName = res.data.data.name
    }

    // 2. 만약 Confirm(확정) 요청이라면 생성/업데이트된 문서를 Submit(docstatus: 1) 처리
    if (docstatus === 1) {
      await frappeApi.put(`/api/resource/Stock Reconciliation/${docName}`, { docstatus: 1 })
    }

    alert(`Adjustment ${docstatus === 1 ? 'Confirmed' : 'Draft Saved'} successfully!`)
    emit('saved')
    
  } catch (error) {
    console.error('Failed to save adjustment:', error)
    
    // Frappe 상세 에러 메시지 파싱
    let errorMsg = 'Failed to save.';
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data._server_messages) {
        // _server_messages는 JSON 문자열 배열인 경우가 많음
        try {
          const messages = JSON.parse(data._server_messages);
          errorMsg = messages.map(m => JSON.parse(m).message).join('\\n');
        } catch(e) {
          errorMsg = data._server_messages;
        }
      } else if (data.exception) {
        errorMsg = data.exception;
      } else if (data.message) {
        errorMsg = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      }
    }
    
    alert(`[Frappe Error]\\n${errorMsg}`);
  }
}
</script>

<style scoped>
.adj-detail-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f4f6f9;
  font-family: system-ui, sans-serif;
  overflow: hidden; /* 전체 화면 스크롤 방지 */
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #f4f6f9;
  flex-shrink: 0;
}

.back-btn {
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  width: 40px;
  height: 40px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
}
.back-btn:hover { background: #f1f5f9; }

.header-nav h2 {
  margin: 0;
  font-size: 22px;
  color: #1e293b;
}

.draft-badge {
  background: #fef9c3;
  color: #854d0e;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.content-layout {
  display: flex;
  gap: 20px;
  padding: 0 20px 20px;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  overflow: hidden; /* 전체 패널 스크롤 방지 */
}

.right-panel {
  width: 320px;
  flex-shrink: 0;
}

.panel-card {
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.search-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.search-card label {
  font-weight: bold;
  color: #334155;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  border: 1px solid #0ea5e9;
  border-radius: 6px;
  padding: 10px;
}
.search-input-wrapper input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0 10px;
  font-size: 15px;
}
.scanner-icon {
  color: #94a3b8;
  cursor: pointer;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  margin-top: 4px;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
}
.dropdown-item:hover {
  background: #f8fafc;
}

.item-img-placeholder {
  width: 40px;
  height: 40px;
  background: #f1f5f9;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.item-info { flex: 1; }
.item-name { font-weight: 600; color: #1e293b; font-size: 14px; }
.item-color { font-size: 12px; color: #64748b; margin-top: 2px; }
.item-stock-badge {
  background: #dcfce7;
  color: #166534;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.items-card {
  flex: 1;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.items-table-wrapper {
  flex: 1;
  overflow-y: auto;
}
/* 스크롤바 커스텀 */
.items-table-wrapper::-webkit-scrollbar { width: 8px; }
.items-table-wrapper::-webkit-scrollbar-track { background: #f1f5f9; }
.items-table-wrapper::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

.items-table {
  width: 100%;
  border-collapse: collapse;
}
.items-table th, .items-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}
.items-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #64748b;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 2;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.btn-delete {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.6;
  transition: opacity 0.2s;
  padding: 5px;
}
.btn-delete:hover {
  opacity: 1;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.img-placeholder {
  width: 32px;
  height: 32px;
  background: #f1f5f9;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.qty-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}
.qty-box, .qty-each {
  width: 50px;
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}
.qty-box:focus, .qty-each:focus {
  border-color: #0ea5e9;
  outline: none;
}

.text-center { text-align: center; }
.font-bold { font-weight: bold; }
.text-gray { color: #64748b; }
.text-sm { font-size: 12px; }
.text-green { color: #10b981; }
.text-red { color: #ef4444; }

.summary-card {
  display: flex;
  justify-content: space-between;
  background: white;
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-item .label {
  font-size: 12px;
  color: #64748b;
}
.summary-item .value {
  font-size: 18px;
  font-weight: bold;
  color: #0f172a;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.form-group label {
  font-size: 13px;
  font-weight: bold;
  color: #1e293b;
}
.form-group select, .form-group textarea {
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
}
.form-group select:focus, .form-group textarea:focus {
  border-color: #0ea5e9;
}
.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bottom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  background: white;
  border-top: 1px solid #e2e8f0;
}
.btn-cancel {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-draft {
  background: white;
  border: 1px solid #0ea5e9;
  color: #0ea5e9;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-confirm {
  background: #0ea5e9;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}
.btn-cancel:hover { background: #f1f5f9; }
.btn-draft:hover { background: #f0f9ff; }
.btn-confirm:hover { background: #0284c7; }
</style>
