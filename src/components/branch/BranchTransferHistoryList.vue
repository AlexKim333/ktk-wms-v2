<template>
  <div class="history-list-container">
    <div class="header-actions">
      <h2>📅 재고이동 현황 (예약 및 완료)</h2>
      <button class="btn-create" @click="$emit('create-new')">➕ CREAR (새 재고이동)</button>
    </div>

    <div class="filters">
      <input type="text" v-model="searchQuery" placeholder="출고 검색 (고객명, 번호)" class="filter-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="all">전체 (All)</option>
        <option value="incomplete">미결 (Incomplete - 예약)</option>
        <option value="completed">완료 (Completed)</option>
      </select>
      <button class="btn-refresh" @click="fetchHistory" style="padding: 10px 15px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569;">
        🔄 새로고침
      </button>
    </div>

    <div class="table-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>이동 번호</th>
            <th>날짜</th>
            <th>담당자 / 요청자</th>
            <th>출발 ➔ 도착 창고</th>
            <th>상태</th>
            <th class="action-cell"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredHistory" :key="res.name" class="clickable-row">
            <td class="res-id" @click="openDetail(res)">{{ res.name }}</td>
            <td @click="openDetail(res)">{{ res.posting_date || res.creation?.split(' ')[0] }}</td>
            <td class="customer-name" @click="openDetail(res)">{{ res.custom_orderer || res.owner }}</td>
            <td @click="openDetail(res)">
              {{ res.from_warehouse }} ➔ {{ res.to_warehouse }}
            </td>
            <td @click="openDetail(res)">
              <span v-if="res.docstatus === 1" class="status-badge status-completed">이동 완료</span>
              <span v-else-if="res.docstatus === 0" class="status-badge status-pending">이동 예약</span>
              <span v-else class="status-badge status-cancelled">취소됨</span>
            </td>
            <td>
              <button v-if="res.docstatus === 0" class="btn-delete" @click.stop="deleteHistory(res.name)" title="삭제">🗑️</button>
            </td>
          </tr>
          <tr v-if="filteredHistory.length === 0">
            <td colspan="6" style="text-align: center; padding: 30px; color: #94a3b8;">
              조회된 내역이 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedHistory" class="modal-overlay" @click.self="selectedHistory = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3>상세 정보 ({{ selectedHistory.name }})</h3>
          <button class="close-btn" @click="selectedHistory = null">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-card">
              <label>담당자</label>
              <div class="val">{{ selectedHistory.custom_orderer || selectedHistory.owner }}</div>
            </div>
            <div class="detail-card">
              <label>날짜</label>
              <div class="val">{{ selectedHistory.posting_date || selectedHistory.creation?.split(' ')[0] }}</div>
            </div>
            <div class="detail-card">
              <label>상태</label>
              <div class="val" :class="{'text-green-600': selectedHistory.docstatus === 1, 'text-yellow-600': selectedHistory.docstatus === 0}">
                {{ selectedHistory.docstatus === 1 ? '이동 완료' : '이동 예약' }}
              </div>
            </div>
          </div>
          
          <table class="detail-items-table">
            <thead>
              <tr>
                <th>품목 코드</th>
                <th>품명</th>
                <th>컬러</th>
                <th>요청 수량 (낱장)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedHistoryItems" :key="item.name">
                <td style="font-weight:bold;">{{ item.item_code }}</td>
                <td>{{ item.item_name }}</td>
                <td>{{ item.custom_color || '-' }}</td>
                <td style="font-weight:bold; color:#0ea5e9;">{{ item.qty }} 개</td>
              </tr>
              <tr v-if="selectedHistoryItems.length === 0">
                <td colspan="4" style="text-align: center; padding: 15px; color: #94a3b8;">데이터를 불러오는 중입니다...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const emit = defineEmits(['create-new'])

const frappeApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

const historys = ref([])
const searchQuery = ref('')
const statusFilter = ref('all')

const selectedHistory = ref(null)
const selectedHistoryItems = ref([])

const fetchHistory = async () => {
  if (!authStore.user?.branch_name) return
  
  try {
    let docstatusFilter = []
    if (statusFilter.value === 'incomplete') docstatusFilter = ['docstatus', '=', 0]
    else if (statusFilter.value === 'completed') docstatusFilter = ['docstatus', '=', 1]
    else docstatusFilter = ['docstatus', 'in', [0, 1]]

    const res = await frappeApi.get('/api/resource/Stock Entry', {
      params: {
        fields: JSON.stringify(['name', 'stock_entry_type', 'posting_date', 'creation', 'custom_orderer', 'to_warehouse', 'from_warehouse', 'docstatus', 'owner']),
        filters: JSON.stringify([
          docstatusFilter,
          ['stock_entry_type', '=', 'Material Transfer'],
          ['to_warehouse', '=', authStore.user.branch_name]
        ]),
        limit_page_length: 100,
        order_by: 'creation desc'
      }
    })
    
    historys.value = res.data.data || []
  } catch (error) {
    console.error('재고 이동 이력을 불러오는 중 오류 발생:', error)
  }
}

onMounted(() => {
  fetchHistory()
})

const filteredHistory = computed(() => {
  return historys.value.filter(res => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || 
      (res.name && res.name.toLowerCase().includes(q)) || 
      (res.custom_orderer && res.custom_orderer.toLowerCase().includes(q))
    
    return matchSearch
  })
})

const openDetail = async (res) => {
  selectedHistory.value = res
  selectedHistoryItems.value = []
  
  try {
    const detail = await frappeApi.get(`/api/resource/Stock Entry/${res.name}`)
    selectedHistoryItems.value = detail.data.data.items || []
  } catch (err) {
    console.error('상세 조회 실패:', err)
  }
}

const deleteHistory = async (name) => {
  if (!confirm(`예약 건(${name})을 삭제하시겠습니까?`)) return
  try {
    await frappeApi.delete(`/api/resource/Stock Entry/${name}`)
    fetchHistory()
  } catch (error) {
    alert('삭제에 실패했습니다.')
    console.error('삭제 오류:', error)
  }
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
.status-completed { background: #bbf7d0; color: #166534; }
.status-cancelled { background: #fecaca; color: #991b1b; }

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
  width: 600px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.modal-header {
  background: #1e293b;
  color: white;
  padding: 15px 20px;
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 { margin: 0; font-size: 18px; }
.close-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }
.modal-body { padding: 20px; max-height: 70vh; overflow-y: auto; }
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
</style>
