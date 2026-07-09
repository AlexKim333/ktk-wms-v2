<template>
  <div class="outbound-list-container">
    <div class="header-actions">
      <h2>📅 출고 현황 (Outbounds)</h2>
      <button class="btn-create" @click="$emit('create-new')">➕ CREAR (새 출고)</button>
    </div>

    <div class="filters">
      <input type="text" v-model="searchQuery" placeholder="출고 검색 (고객명, 번호)" class="filter-input" />
      <select v-model="branchFilter" class="filter-select">
        <option value="all">모든 지점 (All Branches)</option>
        <option v-for="branch in branchList" :key="branch.name" :value="branch.name">
          {{ branch.warehouse_name || branch.name }}
        </option>
      </select>
      <select v-model="statusFilter" class="filter-select">
        <option value="all">전체 (All)</option>
        <option value="incomplete">진행 중 (Incomplete)</option>
        <option value="completed">완료됨 (Completed)</option>
      </select>
    </div>

    <div class="table-wrapper">
      <table class="outbound-table">
        <thead>
          <tr>
            <th>출고 번호</th>
            <th>날짜</th>
            <th>담당자 / 고객명</th>
            <th>담당 지점</th>
            <th>유형</th>
            <th class="action-cell"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredOutbounds" :key="res.name" @click="openDetail(res)" class="clickable-row">
            <td class="res-id">{{ res.name }}</td>
            <td>{{ res.posting_date }}</td>
            <td class="customer-name">{{ [res.custom_orderer, res.custom_customer].filter(Boolean).join(' / ') || '-' }}</td>
            <td>{{ res.custom_ordering_branch || res.to_warehouse || res.from_warehouse || '-' }}</td>
            <td>
              <span class="res-badge" :style="getStatusStyle(res)">{{ getStatusText(res) }}</span>
            </td>
            <td class="action-cell" @click.stop>
              <button class="btn-delete" @click="cancelOutbound(res.name)" title="출고 취소">🗑️</button>
            </td>
          </tr>
          <tr v-if="filteredOutbounds.length === 0">
            <td colspan="8" class="empty-msg">조건에 맞는 출고이 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 🌟 출고 상세 팝업 -->
    <div class="modal-overlay" v-if="selectedOutbound">
      <div class="modal-content modal-large">
        <div class="modal-header with-nav">
          <button class="nav-arrow" @click="goToPreviousOutbound" title="이전 출고">◀</button>
          <h3>출고 상세: {{ selectedOutbound.name }}</h3>
          <button class="nav-arrow" @click="goToNextOutbound" title="다음 출고">▶</button>
          <button class="close-btn" @click="selectedOutbound = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid" style="flex-wrap: wrap;">
            <div class="detail-card">
              <label>유형 / 상태</label>
              <div class="val"><span class="res-badge" :style="getStatusStyle(selectedOutbound)">{{ getStatusText(selectedOutbound) }}</span></div>
            </div>
            <div class="detail-card">
              <label>소스창고 (출발)</label>
              <div class="val">{{ selectedOutbound.from_warehouse || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>담당 지점 (도착)</label>
              <div class="val">{{ selectedOutbound.custom_ordering_branch || selectedOutbound.to_warehouse || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>담당자 / 고객명</label>
              <div class="val">{{ [selectedOutbound.custom_orderer, selectedOutbound.custom_customer].filter(Boolean).join(' / ') || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>출고일</label>
              <div class="val">{{ selectedOutbound.posting_date }}</div>
            </div>
          </div>
          
          <table class="detail-items-table">
            <thead>
              <tr>
                <th>품목명</th>
                <th>컬러</th>
                <th>출고 박스</th>
                <th>출고 낱개</th>
                <th>총 수량</th>
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
                  {{ getBoxQty(item.qty, getItemDetails(item.item_code).custom_pack_qty) }} 박스
                </td>
                <td style="color: #f59e0b; font-weight: bold;">
                  {{ getEachQty(item.qty, getItemDetails(item.item_code).custom_pack_qty) }} 개
                </td>
                <td style="color: #0ea5e9; font-weight: bold;">{{ item.qty }} 개</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-load-cart" @click="loadToCart">
            ✏️ 내역 수정 (장바구니로 이동)
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  branchList: {
    type: Array,
    default: () => []
  },
  rawItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['create-new', 'edit-outbound'])

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const outbounds = ref([])
const searchQuery = ref('')
const statusFilter = ref('incomplete')
const branchFilter = ref('all')
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
        fields: JSON.stringify(['name', 'stock_entry_type', 'posting_date', 'custom_ordering_branch', 'custom_orderer', 'custom_customer', 'to_warehouse', 'from_warehouse', 'docstatus', 'total_outgoing_value']),
        filters: JSON.stringify([['docstatus', '=', 1], ['stock_entry_type', 'in', ['Material Issue', 'Material Transfer']]]),
        limit_page_length: 100,
        order_by: 'creation desc'
      }
    })
    
    outbounds.value = resWithProgress.data.data || []
  } catch (error) {
    console.error('출고 목록 조회 에러:', error)
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
      
    // 2. Status Filter
    let matchStatus = true
    if (statusFilter.value === 'incomplete') {
      matchStatus = true;
    } else if (statusFilter.value === 'completed') {
      matchStatus = false;
    }
    
    // 3. Branch Filter
    let matchBranch = true
    if (branchFilter.value !== 'all') {
      const b = res.custom_ordering_branch || res.to_warehouse || res.from_warehouse || ''
      matchBranch = b.includes(branchFilter.value)
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
  return res.stock_entry_type === 'Material Transfer' ? '이동 완료' : '출고 완료'
}

const getProgressPercent = (res) => {
  return Math.round(res.per_ordered || res.per_received || 0)
}

const openDetail = async (res) => {
  selectedOutbound.value = res
  try {
    const detail = await frappeApi.get(`/api/resource/Stock Entry/${res.name}`)
    selectedOutboundItems.value = detail.data.data.items || []
  } catch (err) {
    console.error('상세 조회 에러:', err)
  }
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
  if (!confirm(`${name} 출고을 취소하시겠습니까?`)) return
  try {
    // Frappe Cancel Method
    await frappeApi.post(`/api/method/frappe.client.cancel`, {
      doctype: 'Stock Entry',
      name: name
    })
    alert('취소되었습니다.')
    fetchOutbounds()
  } catch (error) {
    console.error('취소 에러:', error)
    alert('취소 중 오류가 발생했습니다. 이미 일부 출고된 출고일 수 있습니다.')
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
</style>
