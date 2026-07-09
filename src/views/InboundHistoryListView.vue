<template>
  <div class="history-list-container">
    <div class="header-actions">
      <h2>📅 취소/수정 내역 현황 (InboundHistorys)</h2>
      <button class="btn-create" @click="$emit('create-new')">➕ CREAR (새 취소/수정 내역)</button>
    </div>

    <div class="filters">
      <input type="text" v-model="searchQuery" placeholder="취소/수정 내역 검색 (고객명, 번호)" class="filter-input" />
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
      <table class="history-table">
        <thead>
          <tr>
            <th>전표 ID</th>
            <th>생성일</th>
            <th>공급자 ➡️ 도착 창고</th>
            <th>발주자 / 발주처</th>
            <th>취소/수정자</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredInboundHistorys" :key="res.name" @click="openDetail(res)" class="clickable-row">
            <td class="res-id">{{ res.name }}</td>
            <td>{{ res.creation ? res.creation.split(' ')[0] : '' }}</td>
            <td class="customer-name">{{ res.supplier || '-' }} ➡️ {{ res.to_warehouse || '-' }}</td>
            <td>{{ [res.custom_orderer, res.custom_ordering_branch].filter(Boolean).join(' / ') || '-' }}</td>
            <td class="customer-name" style="color:#ef4444">{{ res.modified_by || '-' }}</td>
            <td>
              <span class="res-badge" style="background:#fef2f2;color:#b91c1c;padding:4px 8px;border-radius:4px;font-weight:bold;font-size:0.85rem">취소/대체됨</span>
            </td>
          </tr>
          <tr v-if="filteredInboundHistorys.length === 0">
            <td colspan="5" class="empty-msg">조건에 맞는 취소/수정 내역이 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 🌟 입고 상세 팝업 -->
    <div class="modal-overlay" v-if="selectedInboundHistory">
      <div class="modal-content modal-large">
        <div class="modal-header with-nav">
          <button class="nav-arrow" @click="goToPreviousHistory" title="이전 내역">◀</button>
          <h3>내역 상세: {{ selectedInboundHistory.name }}</h3>
          <button class="nav-arrow" @click="goToNextHistory" title="다음 내역">▶</button>
          <button class="close-btn" @click="selectedInboundHistory = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-card">
              <label>공급자 (Source)</label>
              <div class="val">{{ selectedInboundHistory.supplier || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>도착 창고 (Target)</label>
              <div class="val">{{ selectedInboundHistory.to_warehouse || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>발주처 (Orderer Branch)</label>
              <div class="val">{{ selectedInboundHistory.custom_ordering_branch || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>발주자 (Orderer) / 취소자</label>
              <div class="val">{{ selectedInboundHistory.custom_orderer || '-' }} <br/> <span style="color:#ef4444; font-size: 0.9em">(취소자: {{ selectedInboundHistory.modified_by }})</span></div>
            </div>
            <div class="detail-card">
              <label>생성일</label>
              <div class="val">{{ selectedInboundHistory.creation ? selectedInboundHistory.creation.split(' ')[0] : '' }}</div>
            </div>
          </div>
          
          <div class="compare-tables">
            <div class="compare-section">
              <h4 style="color: #ef4444; margin-bottom: 10px;">📉 취소된 내역 (수정 전)</h4>
              <table class="detail-items-table">
                <thead>
                  <tr>
                    <th>품목명</th>
                    <th>수량</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in selectedInboundHistoryItems" :key="item.name">
                    <td style="text-align: left; font-weight: bold;">{{ item.item_name || item.item_code }}</td>
                    <td style="color: #ef4444; font-weight: bold;">{{ item.qty }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="compare-section" v-if="amendedDocumentItems.length > 0">
              <h4 style="color: #0ea5e9; margin-bottom: 10px;">📈 재발행된 내역 (수정 후: {{ amendedDocumentName }})</h4>
              <table class="detail-items-table">
                <thead>
                  <tr>
                    <th>품목명</th>
                    <th>수량</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in amendedDocumentItems" :key="item.name">
                    <td style="text-align: left; font-weight: bold;">{{ item.item_name || item.item_code }}</td>
                    <td style="color: #0ea5e9; font-weight: bold;">{{ item.qty }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-load-cart" @click="loadToCart">
            🛒 장바구니로 이동하여 수정/입고
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
  }
})

const emit = defineEmits(['create-new', 'edit-history'])

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const historys = ref([])
const searchQuery = ref('')
const branchFilter = ref('all')
const selectedInboundHistory = ref(null)
const selectedInboundHistoryItems = ref([])
const amendedDocumentItems = ref([])
const amendedDocumentName = ref('')

const fetchInboundHistorys = async () => {
  try {
    const resWithProgress = await frappeApi.get('/api/resource/Stock Entry', {
      params: {
        fields: JSON.stringify(['name', 'stock_entry_type', 'creation', 'custom_ordering_branch', 'custom_orderer', 'supplier', 'to_warehouse', 'from_warehouse', 'modified_by', 'modified']),
        filters: JSON.stringify([['docstatus', '=', 2], ['stock_entry_type', 'in', ['Material Receipt', 'Material Transfer']]]),
        limit_page_length: 100,
        order_by: 'creation desc'
      }
    })
    
    historys.value = resWithProgress.data.data || []
  } catch (error) {
    console.error('취소/수정 내역 목록 조회 에러:', error)
  }
}

onMounted(() => {
  fetchInboundHistorys()
})

const filteredInboundHistorys = computed(() => {
  return historys.value.filter(res => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || 
      (res.name && res.name.toLowerCase().includes(q)) || 
      (res.custom_orderer && res.custom_orderer.toLowerCase().includes(q))
      
    let matchBranch = true
    if (branchFilter.value !== 'all') {
      const resBranch = res.custom_ordering_branch || res.to_warehouse || res.from_warehouse || ''
      matchBranch = resBranch.includes(branchFilter.value)
    }
    
    return matchSearch && matchBranch
  })
})

const openDetail = async (res) => {
  selectedInboundHistory.value = res
  amendedDocumentItems.value = []
  amendedDocumentName.value = ''
  
  try {
    const detail = await frappeApi.get(`/api/resource/Stock Entry/${res.name}`)
    selectedInboundHistoryItems.value = detail.data.data.items || []
    
    // 수정 후(Amended) 문서 찾기
    const amendedQuery = await frappeApi.get('/api/resource/Stock Entry', {
      params: {
        fields: JSON.stringify(['name']),
        filters: JSON.stringify([['amended_from', '=', res.name]]),
        limit_page_length: 1
      }
    })
    
    if (amendedQuery.data.data && amendedQuery.data.data.length > 0) {
      const am_name = amendedQuery.data.data[0].name
      amendedDocumentName.value = am_name
      const am_detail = await frappeApi.get(`/api/resource/Stock Entry/${am_name}`)
      amendedDocumentItems.value = am_detail.data.data.items || []
    }
  } catch (err) {
    console.error('상세 조회 에러:', err)
  }
}

const goToPreviousHistory = () => {
  if (!selectedInboundHistory.value) return
  const list = filteredInboundHistorys.value
  const index = list.findIndex(r => r.name === selectedInboundHistory.value.name)
  if (index > 0) openDetail(list[index - 1])
}

const goToNextHistory = () => {
  if (!selectedInboundHistory.value) return
  const list = filteredInboundHistorys.value
  const index = list.findIndex(r => r.name === selectedInboundHistory.value.name)
  if (index >= 0 && index < list.length - 1) openDetail(list[index + 1])
}

const loadToCart = () => {
  emit('edit-history', {
    ...selectedInboundHistory.value,
    items: selectedInboundHistoryItems.value,
    sourceNav: 'inbound-history'
  })
  selectedInboundHistory.value = null
}
</script>

<style scoped>
.history-list-container {
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
.history-table {
  width: 100%;
  border-collapse: collapse;
}
.history-table th, .history-table td {
  padding: 12px;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
}
.history-table th {
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
</style>

<style>
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
.compare-tables {
  display: flex;
  gap: 20px;
  margin-top: 15px;
}
.compare-section {
  flex: 1;
  background: #f8fafc;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}
</style>
