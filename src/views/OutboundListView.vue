<template>
  <div class="outbound-list-container">
    <div class="header-actions">
      <h2>📅 {{ listType === 'Material Transfer' ? $t('outbound_list.title_transfer') : $t('outbound_list.title_outbound') }}</h2>
      <button class="btn-create" @click="$emit('create-new')">➕ {{ listType === 'Material Transfer' ? $t('outbound_list.btn_create_transfer') : $t('outbound_list.btn_create_outbound') }}</button>
    </div>

    <div class="filters">
      <input type="text" v-model="searchQuery" :placeholder="$t('outbound_list.search_placeholder')" class="filter-input" />
      <template v-if="listType === 'Material Transfer'">
        <select v-model="sourceFilter" class="filter-select">
          <option value="all">{{ $t('outbound_list.all_source') }}</option>
          <option v-for="branch in branchList" :key="'src-'+branch.name" :value="branch.name">
            {{ branch.warehouse_name || branch.name }}
          </option>
        </select>
        <select v-model="targetFilter" class="filter-select">
          <option value="all">{{ $t('outbound_list.all_target') }}</option>
          <option v-for="branch in branchList" :key="'tgt-'+branch.name" :value="branch.name">
            {{ branch.warehouse_name || branch.name }}
          </option>
        </select>
      </template>
      <template v-else>
        <select v-model="branchFilter" class="filter-select">
          <option value="all">{{ $t('outbound_list.all_branches') }}</option>
          <option v-for="branch in branchList" :key="branch.name" :value="branch.name">
            {{ branch.warehouse_name || branch.name }}
          </option>
        </select>
      </template>
      <select v-model="statusFilter" class="filter-select">
        <option value="all">{{ $t('outbound_list.status_all') }}</option>
        <option value="incomplete">{{ $t('outbound_list.status_incomplete') }}</option>
        <option value="completed">{{ $t('outbound_list.status_completed') }}</option>
      </select>
    </div>

    <div class="table-wrapper">
      <table class="outbound-table">
        <thead>
          <tr>
            <th>{{ $t('outbound_list.col_outbound_no') }}</th>
            <th>{{ $t('outbound_list.col_date') }}</th>
            <th>{{ $t('outbound_list.col_manager_customer') }}</th>
            <th>{{ listType === 'Material Transfer' ? $t('outbound_list.col_source_target') : $t('outbound_list.col_manager_branch') }}</th>
            <th>{{ $t('outbound_list.col_type') }}</th>
            <th class="action-cell"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredOutbounds" :key="res.name" 
              @click="openDetail(res)" 
              @mouseenter="handleMouseEnter($event, res)"
              @mouseleave="handleMouseLeave"
              class="clickable-row">
            <td class="res-id">{{ res.name }}</td>
            <td>{{ res.posting_date }}</td>
            <td class="customer-name">{{ [res.custom_orderer, res.custom_customer].filter(Boolean).join(' / ') || res.owner || '-' }}</td>
            <td>
              <template v-if="listType === 'Material Transfer'">
                {{ res.from_warehouse }} ➔ {{ res.to_warehouse }}
              </template>
              <template v-else>
                {{ res.custom_ordering_branch || res.to_warehouse || res.from_warehouse || '-' }}
              </template>
            </td>
            <td>
              <span class="res-badge" :style="getStatusStyle(res)">{{ getStatusText(res) }}</span>
            </td>
            <td class="action-cell" @click.stop>
              <button class="btn-delete" @click="cancelOutbound(res.name)" :title="$t('outbound_list.btn_delete_title')">🗑️</button>
            </td>
          </tr>
          <tr v-if="filteredOutbounds.length === 0">
            <td colspan="6" class="empty-msg">
              {{ listType === 'Material Transfer' ? $t('outbound_list.empty_msg_transfer') : $t('outbound_list.empty_msg_outbound') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 🌟 출고 상세 팝업 -->
    <div class="modal-overlay" v-if="selectedOutbound">
      <div class="modal-content modal-large">
        <div class="modal-header with-nav">
          <button class="nav-arrow" @click="goToPreviousOutbound" :title="listType === 'Material Transfer' ? $t('outbound_list.btn_prev_transfer') : $t('outbound_list.btn_prev_outbound')">◀</button>
          <h3>{{ listType === 'Material Transfer' ? $t('outbound_list.modal_title_transfer') : $t('outbound_list.modal_title_outbound') }}: {{ selectedOutbound.name }}</h3>
          <button class="nav-arrow" @click="goToNextOutbound" :title="listType === 'Material Transfer' ? $t('outbound_list.btn_next_transfer') : $t('outbound_list.btn_next_outbound')">▶</button>
          <button class="close-btn" @click="selectedOutbound = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid" style="flex-wrap: wrap;">
            <div class="detail-card">
              <label>{{ $t('outbound_list.modal_type_status') }}</label>
              <div class="val"><span class="res-badge" :style="getStatusStyle(selectedOutbound)">{{ getStatusText(selectedOutbound) }}</span></div>
            </div>
            <div class="detail-card">
              <label>{{ $t('outbound_list.modal_source') }}</label>
              <div class="val">{{ selectedOutbound.from_warehouse || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>{{ listType === 'Material Transfer' ? $t('outbound_list.modal_target') : $t('outbound_list.modal_manager_branch') }}</label>
              <div class="val">{{ listType === 'Material Transfer' ? selectedOutbound.to_warehouse : (selectedOutbound.custom_ordering_branch || selectedOutbound.to_warehouse || '-') }}</div>
            </div>
            <div class="detail-card">
              <label>{{ $t('outbound_list.modal_manager_customer') }}</label>
              <div class="val">{{ [selectedOutbound.custom_orderer, selectedOutbound.custom_customer].filter(Boolean).join(' / ') || selectedOutbound.owner || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>{{ listType === 'Material Transfer' ? $t('outbound_list.modal_transfer_date') : $t('outbound_list.modal_outbound_date') }}</label>
              <div class="val">{{ selectedOutbound.posting_date }}</div>
            </div>
          </div>
          
          <table class="detail-items-table">
            <thead>
              <tr>
                <th>{{ $t('outbound_list.modal_col_item') }}</th>
                <th>{{ $t('outbound_list.modal_col_color') }}</th>
                <th>{{ listType === 'Material Transfer' ? $t('outbound_list.modal_col_transfer_box') : $t('outbound_list.modal_col_outbound_box') }}</th>
                <th>{{ listType === 'Material Transfer' ? $t('outbound_list.modal_col_transfer_ea') : $t('outbound_list.modal_col_outbound_ea') }}</th>
                <th>{{ $t('outbound_list.modal_col_total') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedOutboundItems" :key="item.name">
                <td style="text-align: left; font-weight: bold;">{{ item.item_name || item.item_code }}</td>
                <td>
                  <span v-if="getItemDetails(item.item_code).custom_color" class="color-badge">
                    {{ getItemDetails(item.item_code).custom_color }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td style="color: #10b981; font-weight: bold;">
                  {{ getBoxQty(item.qty, getItemDetails(item.item_code).custom_pack_qty) }} {{ $t('outbound_list.box') }}
                </td>
                <td style="color: #f59e0b; font-weight: bold;">
                  {{ getEachQty(item.qty, getItemDetails(item.item_code).custom_pack_qty) }} {{ $t('outbound_list.ea') }}
                </td>
                <td style="color: #0ea5e9; font-weight: bold;">{{ item.qty }} {{ $t('outbound_list.ea') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-load-cart" @click="loadToCart">
            ✏️ {{ $t('outbound_list.btn_edit') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="hoverTooltip.visible" class="hover-tooltip" :style="{ top: hoverTooltip.y + 'px', left: hoverTooltip.x + 'px' }">
      <div class="tooltip-header">
        요청자: {{ hoverTooltip.data.requester }}
      </div>
      <table class="tooltip-table">
        <thead>
          <tr>
            <th>품목명</th>
            <th>박스</th>
            <th>낱개</th>
            <th>총수량</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="hoverTooltip.loading">
            <td colspan="4" style="text-align: center; padding: 10px;">로딩 중...</td>
          </tr>
          <tr v-else-if="hoverTooltip.items.length === 0">
            <td colspan="4" style="text-align: center; padding: 10px;">데이터가 없습니다.</td>
          </tr>
          <tr v-for="item in hoverTooltip.items" :key="item.item_code">
            <td style="font-weight: 500;">{{ item.item_code }}</td>
            <td style="text-align: right;">{{ Math.floor(item.qty / getPackQty(item.item_code)) || 0 }}</td>
            <td style="text-align: right;">{{ item.qty % getPackQty(item.item_code) || 0 }}</td>
            <td style="text-align: right; font-weight: bold; color: #0f172a;">{{ item.qty }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { useRouter } from 'vue-router'

// Tooltip State
const hoverTooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  data: {},
  items: [],
  loading: false
})
const hoverTimeout = ref(null)
const itemCache = ref({})

const props = defineProps({
  branchList: {
    type: Array,
    required: true
  },
  rawItems: {
    type: Array,
    default: () => []
  },
  listType: {
    type: String,
    default: 'Material Issue' // 'Material Issue' | 'Material Transfer'
  }
})

const getPackQty = (itemCode) => {
  const found = props.rawItems.find(i => i.name === itemCode)
  return found?.custom_pack_qty || 1
}

const { t } = useI18n()

const emit = defineEmits(['create-new', 'edit-outbound', 'refresh-items'])

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const outbounds = ref([])
const searchQuery = ref('')
const branchFilter = ref('all')
const sourceFilter = ref('all')
const targetFilter = ref('all')
const statusFilter = ref('all')
const selectedOutbound = ref(null)
const selectedOutboundItems = ref([])
const getItemDetails = (itemCode) => {
  return props.rawItems.find(i => i.name === itemCode) || {}
}

const getBoxQty = (qty, packQty) => {
  if (!packQty) return 0
  return Math.floor(qty / packQty)
}

const getEachQty = (qty, packQty) => {
  if (!packQty) return qty
  return qty % packQty
}

const fetchOutbounds = async () => {
  try {
    const resWithProgress = await frappeApi.get('/api/resource/Stock Entry', {
      params: {
        fields: JSON.stringify(['name', 'stock_entry_type', 'posting_date', 'custom_ordering_branch', 'custom_orderer', 'custom_customer', 'to_warehouse', 'from_warehouse', 'docstatus', 'total_outgoing_value', 'owner']),
        filters: JSON.stringify([['docstatus', '=', 1], ['stock_entry_type', 'in', ['Material Issue', 'Material Transfer']]]),
        limit_page_length: 100,
        order_by: 'creation desc',
        _t: Date.now() // 캐시 방지 (브라우저/클라우드플레어)
      }
    })
    
    const allOutbounds = resWithProgress.data.data || []
    
    // JS 레벨에서 한 번 더 필터링 (구 버전 API 호출 유지하되 현재 탭에 맞는 것만 표시)
    outbounds.value = allOutbounds.filter(doc => doc.stock_entry_type === props.listType);
    console.log("FILTERED OUTBOUNDS (JS):", outbounds.value);
  } catch (error) {
    console.error('출고 목록 조회 에러:', error)
    const errorMsg = error.response ? (error.response.data.exc_type || JSON.stringify(error.response.data)) : error.message;
    alert(t('pos.msg_err_res_svr') + '\n' + errorMsg);
  }
}

onMounted(() => {
  fetchOutbounds()
})

const filteredOutbounds = computed(() => {
  return outbounds.value.filter(res => {
    // 1. Search Filter
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || 
      (res.name && res.name.toLowerCase().includes(q)) || 
      (res.custom_orderer && res.custom_orderer.toLowerCase().includes(q))
      
    // 2. Status Filter (Stock Entries with docstatus=1 are always completed)
    let matchStatus = true
    if (statusFilter.value === 'incomplete') {
      matchStatus = false; // No incomplete stock entries are fetched
    } else if (statusFilter.value === 'completed') {
      matchStatus = true;
    }
    
    // 3. Branch Filter
    let matchBranch = true
    if (props.listType === 'Material Transfer') {
      if (sourceFilter.value !== 'all') {
        matchBranch = matchBranch && (res.from_warehouse || '').includes(sourceFilter.value)
      }
      if (targetFilter.value !== 'all') {
        matchBranch = matchBranch && (res.to_warehouse || '').includes(targetFilter.value)
      }
    } else {
      if (branchFilter.value !== 'all') {
        const b = res.custom_ordering_branch || res.to_warehouse || res.from_warehouse || ''
        matchBranch = b.includes(branchFilter.value)
      }
    }
    
    return matchSearch && matchStatus && matchBranch
  })
})

const getStatusStyle = (res) => {
  return {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.85rem',
    fontWeight: 'bold'
  }
}

const getStatusText = (res) => {
  return res.stock_entry_type === 'Material Transfer' ? t('status.transfer_completed') : t('status.outbound_completed')
}

const getProgressPercent = (res) => {
  return Math.round(res.per_ordered || res.per_received || 0)
}

const openDetail = async (res) => {
  selectedOutbound.value = res
  try {
    const detail = await frappeApi.get(`/api/resource/Stock Entry/${res.name}`)
    selectedOutboundItems.value = detail.data.data.items || []
    itemCache.value[res.name] = selectedOutboundItems.value
  } catch (error) {
    console.error('상세 조회 에러:', error)
  }
}

const handleMouseEnter = (event, res) => {
  if (hoverTimeout.value) clearTimeout(hoverTimeout.value)
  
  const requester = [res.custom_orderer, res.custom_customer].filter(Boolean).join(' / ') || res.owner || '-'
  
  let yPos = event.clientY + 20;
  // 화면 하단 여유 공간이 300px 이하면 위쪽으로 팝업 (센스 장착!)
  if (window.innerHeight - event.clientY < 300) {
    yPos = Math.max(10, event.clientY - 300);
  }

  hoverTooltip.value = {
    visible: false,
    x: event.clientX + 20,
    y: yPos,
    data: { requester },
    items: [],
    loading: true
  }

  hoverTimeout.value = setTimeout(async () => {
    hoverTooltip.value.visible = true
    
    if (itemCache.value[res.name]) {
      hoverTooltip.value.items = itemCache.value[res.name]
      hoverTooltip.value.loading = false
      return
    }

    try {
      const detail = await frappeApi.get(`/api/resource/Stock Entry/${res.name}`)
      const items = detail.data.data.items || []
      itemCache.value[res.name] = items
      hoverTooltip.value.items = items
    } catch (err) {
      console.error('Hover fetch error:', err)
    } finally {
      hoverTooltip.value.loading = false
    }
  }, 400) // 400ms 딜레이
}

const handleMouseLeave = () => {
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
  hoverTooltip.value.visible = false
}

const goToPreviousOutbound = () => {
  if (!selectedOutbound.value) return
  const list = filteredOutbounds.value
  const index = list.findIndex(r => r.name === selectedOutbound.value.name)
  if (index > 0) {
    openDetail(list[index - 1])
  }
}

const goToNextOutbound = () => {
  if (!selectedOutbound.value) return
  const list = filteredOutbounds.value
  const index = list.findIndex(r => r.name === selectedOutbound.value.name)
  if (index >= 0 && index < list.length - 1) {
    openDetail(list[index + 1])
  }
}

const loadToCart = () => {
  // 선택된 출고과 해당 아이템들을 PosView로 전달하여 장바구니 세팅
  emit('edit-outbound', {
    ...selectedOutbound.value,
    items: selectedOutboundItems.value,
    sourceNav: 'outbound-list'
  })
  selectedOutbound.value = null
}

const cancelOutbound = async (name) => {
  if (!confirm(t('outbound_list.msg_confirm_cancel', { name: name }))) return
  try {
    // Frappe Cancel Method
    await frappeApi.post(`/api/method/frappe.client.cancel`, {
      doctype: 'Stock Entry',
      name: name
    })
    alert(t('outbound_list.msg_cancel_success'))
    fetchOutbounds()
    emit('refresh-items')
  } catch (error) {
    console.error('취소 에러:', error)
    alert(t('outbound_list.msg_cancel_error'))
  }
}
</script>

<style scoped>
.outbound-list-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header-actions h2 {
  margin: 0;
  color: #1e293b;
}
.btn-create {
  background: #0ea5e9;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(14, 165, 233, 0.2);
}
.btn-create:hover { background: #0284c7; }

.filters {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}
.filter-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}
.filter-select {
  width: 200px;
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
}

.table-wrapper {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.outbound-table {
  width: 100%;
  border-collapse: collapse;
}
.outbound-table th, .outbound-table td {
  padding: 12px;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
}
.outbound-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
  position: sticky;
  top: 0;
  z-index: 10;
}
.clickable-row {
  cursor: pointer;
  transition: background 0.2s;
}
.clickable-row:hover {
  background: #f8fafc;
}
.res-id {
  font-weight: bold;
  color: #3b82f6;
}
.customer-name {
  font-weight: bold;
  color: #334155;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}
.status-pending { background: #fef08a; color: #854d0e; }
.status-partial { background: #fed7aa; color: #c2410c; }
.status-completed { background: #bbf7d0; color: #166534; }
.status-cancelled { background: #fecaca; color: #991b1b; }
.status-default { background: #e2e8f0; color: #475569; }

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}
.progress-fill {
  height: 100%;
  background: #10b981;
}
.progress-text {
  font-size: 11px;
  color: #64748b;
  font-weight: bold;
}

.action-cell {
  width: 50px;
}
.btn-delete {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 6px;
  border-radius: 4px;
}
.btn-delete:hover {
  background: #fee2e2;
}

/* Modal CSS */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 10000;
}
.modal-content {
  background: white;
  border-radius: 8px;
  width: 500px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.modal-large {
  width: 700px;
  max-width: 95%;
}
.with-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.nav-arrow {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;
}
.nav-arrow:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.modal-header {
  background: #1e293b;
  color: white;
  padding: 15px 20px;
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 { margin: 0; font-size: 18px; }
.close-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }
.modal-body { padding: 20px; }
.detail-grid {
  display: flex; gap: 15px; margin-bottom: 20px;
  background: #f8fafc; padding: 15px; border-radius: 6px;
}
.detail-card { flex: 1; }
.detail-card label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
.detail-card .val { font-size: 15px; font-weight: bold; color: #334155; }

.detail-items-table {
  width: 100%; border-collapse: collapse;
}
.detail-items-table th, .detail-items-table td {
  border: 1px solid #e2e8f0; padding: 10px; text-align: center; font-size: 14px;
}
.detail-items-table th { background: #f1f5f9; font-weight: 600; }

.modal-footer {
  padding: 15px 20px; border-top: 1px solid #e2e8f0; background: #f8fafc;
  display: flex; justify-content: flex-end;
}
.btn-load-cart {
  background: #0ea5e9; color: white; border: none; padding: 12px 20px;
  border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px;
}
.btn-load-cart:hover { background: #0284c7; }
.color-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
}

.hover-tooltip {
  position: fixed;
  z-index: 9999;
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 15px;
  width: 350px;
  pointer-events: none;
}

.hover-tooltip .tooltip-header {
  font-size: 14px;
  font-weight: bold;
  color: #0ea5e9;
  margin-bottom: 10px;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 5px;
}

.hover-tooltip .tooltip-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.hover-tooltip .tooltip-table th,
.hover-tooltip .tooltip-table td {
  padding: 6px;
  border-bottom: 1px solid #f1f5f9;
}

.hover-tooltip .tooltip-table th {
  text-align: left;
  background-color: #f8fafc;
  color: #64748b;
  font-weight: bold;
}
</style>
