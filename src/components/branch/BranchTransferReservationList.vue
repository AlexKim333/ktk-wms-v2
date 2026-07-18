<template>
  <div class="reservation-list-container">
    <div class="header-actions">
      <h2>📅 지점 재고이동 예약 현황</h2>
      <button class="btn-create" @click="emit('create-new')">➕ 새 예약 작성</button>
    </div>

    <div class="filters">
      <input type="text" v-model="searchQuery" placeholder="검색 (예약번호 등)" class="filter-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="all">모든 상태 (All)</option>
        <option value="incomplete">진행 중 (Incomplete)</option>
        <option value="completed">완료 (Completed)</option>
      </select>
      <button class="btn-refresh" @click="fetchReservations" style="padding: 10px 15px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569;">
        🔄 새로고침
      </button>
    </div>

    <div class="table-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>예약 번호</th>
            <th>날짜</th>
            <th>소스 (출발 창고)</th>
            <th>타겟 (도착 창고)</th>
            <th>상태</th>
            <th>총 수량</th>
            <th>진행률</th>
            <th class="action-cell">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredReservations" :key="res.name" class="clickable-row">
            <td class="res-id" @click="openDetail(res)">{{ res.name }}</td>
            <td @click="openDetail(res)">{{ res.schedule_date || res.creation?.split(' ')[0] }}</td>
            <td class="customer-name" @click="openDetail(res)">
              <div>{{ res.set_from_warehouse || '-' }}</div>
            </td>
            <td @click="openDetail(res)">
              <div>{{ res.set_warehouse || '-' }}</div>
              <div style="font-size: 11.5px; color: #64748b; margin-top: 4px; font-weight: bold;">{{ res.custom_orderer || res.owner || '-' }}</div>
            </td>
            <td @click="openDetail(res)">
              <span class="status-badge" :class="getStatusClass(res)">{{ translateStatus(res.status, res.docstatus, res.custom_approval_stage) }}</span>
            </td>
            <td @click="openDetail(res)">{{ totalQtyMap[res.name] || 0 }} 개</td>
            <td @click="openDetail(res)">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: getProgressPercent(res) + '%' }"></div>
              </div>
              <span class="progress-text">{{ getProgressPercent(res) }}%</span>
            </td>
            <td>
              <button v-if="userRole === 'Manager' && res.custom_approval_stage === '점원 요청' && res.docstatus === 0" class="btn-approve" @click.stop="approveDraft(res)">
                ✅ 승인
              </button>
              <button v-if="res.docstatus === 0" class="btn-edit" @click.stop="editReservation(res)" title="수정" style="margin-left:5px;">📝</button>
              <button class="btn-delete" @click.stop="cancelReservation(res)" title="삭제" style="margin-left:5px;">🗑️</button>
            </td>
          </tr>
          <tr v-if="filteredReservations.length === 0">
            <td colspan="8" style="text-align: center; padding: 30px; color: #94a3b8;">
              진행 중인 예약 내역이 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedReservation" class="modal-overlay" @click.self="selectedReservation = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3>상세 정보 ({{ selectedReservation.name }})</h3>
          <button class="close-btn" @click="selectedReservation = null">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-card">
              <label>결재 단계</label>
              <div class="val text-yellow-600">{{ selectedReservation.custom_approval_stage }}</div>
            </div>
            <div class="detail-card">
              <label>생성 날짜</label>
              <div class="val">{{ selectedReservation.creation?.split(' ')[0] }}</div>
            </div>
            <div class="detail-card">
              <label>담당 지점장</label>
              <div class="val">{{ selectedReservation.custom_orderer }}</div>
            </div>
          </div>
          
          <table class="detail-items-table">
            <thead>
              <tr>
                <th>품목 코드</th>
                <th>품명</th>
                <th>수량 (Pza)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedReservationItems" :key="item.name">
                <td style="font-weight:bold;">{{ item.item_code }}</td>
                <td>{{ item.item_name }}</td>
                <td style="font-weight:bold; color:#0ea5e9;">{{ item.qty }} 개</td>
              </tr>
              <tr v-if="selectedReservationItems.length === 0">
                <td colspan="3" style="text-align: center; padding: 15px; color: #94a3b8;">데이터를 불러오는 중입니다...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import frappeApi from '../../api/frappe.js'
import { useAuthStore } from '../../stores/auth.js'

const authStore = useAuthStore()
const userRole = computed(() => authStore.user?.access_level || 'Representative')
const emit = defineEmits(['create-new', 'edit-reservation'])

const reservations = ref([])
const filteredReservations = ref([])
const selectedReservation = ref(null)
const selectedReservationItems = ref([])

const searchQuery = ref('')
const statusFilter = ref('incomplete')
const totalQtyMap = ref({})

const fetchReservations = async () => {
  const branch = authStore.user?.branch_name
  if (!branch) {
    console.warn('BranchTransferReservationList: branch_name 없음 — 로그인 지점 정보 확인 필요')
    reservations.value = []
    applyFilters()
    return
  }

  try {
    // 관리자 ReservationListView 와 동일: Vite 프록시 상대경로 `/api` + 세션 쿠키
    // (과거 localhost:8000 직접 호출은 쿠키/CORS로 실패 → 빈 목록)
    const res = await frappeApi.get('/api/resource/Material Request', {
      params: {
        fields: JSON.stringify(['name', 'status', 'docstatus', 'schedule_date', 'customer', 'custom_customer', 'custom_orderer', 'set_warehouse', 'set_from_warehouse', 'material_request_type', 'custom_ordering_branch', 'custom_approval_stage', 'per_ordered', 'per_received', 'owner']),
        filters: JSON.stringify([
          ['docstatus', 'in', [0, 1]],
          ['material_request_type', '=', 'Material Transfer'],
          ['set_warehouse', '=', branch] // 도착 창고 = 로그인한 지점
        ]),
        limit_page_length: 500,
        order_by: 'creation desc'
      }
    })
    reservations.value = res.data.data || []
    
    // 예약 총 수량 계산
    if (reservations.value.length > 0) {
      const detailPromises = reservations.value.map(r => 
        frappeApi.get(`/api/resource/Material Request/${r.name}`)
      )
      const detailResArray = await Promise.all(detailPromises)
      
      const qtyMap = {}
      detailResArray.forEach(resp => {
        const doc = resp.data.data
        if (doc && doc.items) {
          const total = doc.items.reduce((sum, item) => sum + (item.qty || 0), 0)
          qtyMap[doc.name] = total
        }
      })
      totalQtyMap.value = qtyMap
    } else {
      totalQtyMap.value = {}
    }

    applyFilters()
  } catch (error) {
    console.error('Fetch reservations error:', error)
    alert('예약 목록을 불러오지 못했습니다. 네트워크/권한을 확인하세요.')
  }
}

const translateStatus = (status, docstatus, approval_stage) => {
  if (docstatus === 0) {
    if (approval_stage) return `Draft(${approval_stage})`
    return 'Draft'
  }
  if (docstatus === 2) return '취소됨'
  if (status === 'Pending' || status === 'Draft') return '대기 중'
  if (status === 'Partially Ordered') return '부분 주문됨'
  if (status === 'Ordered') return '주문 완료'
  return status || '알 수 없음'
}

const getStatusClass = (res) => {
  if (res.docstatus === 0) return 'status-default'
  if (res.status === 'Pending' || (res.docstatus === 1 && res.status === 'Draft')) return 'status-pending'
  if (res.status?.includes('Partial')) return 'status-partial'
  if (res.status === 'Completed' || res.status === 'Issued' || res.status === 'Transferred' || res.status === 'Received') return 'status-completed'
  if (res.status === 'Cancelled') return 'status-cancelled'
  return 'status-default'
}

const getProgressPercent = (res) => {
  return Math.round(res.per_ordered || res.per_received || 0)
}

const applyFilters = () => {
  let result = reservations.value
  
  if (statusFilter.value !== 'all') {
    if (statusFilter.value === 'incomplete') {
      result = result.filter(res => res.docstatus === 0 || res.status === 'Draft' || res.status === 'Pending' || res.status === 'Partially Ordered' || res.status === 'Partially Issued' || res.status === 'Partially Received' || res.status === 'Partial')
    } else if (statusFilter.value === 'completed') {
      result = result.filter(res => res.status === 'Completed' || res.status === 'Transferred' || res.status === 'Issued' || res.status === 'Received')
    }
  }
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(r => 
      r.name.toLowerCase().includes(q) || 
      (r.owner && r.owner.toLowerCase().includes(q))
    )
  }
  
  filteredReservations.value = result
}

const openDetail = async (res) => {
  selectedReservation.value = { ...res }
  try {
    const detail = await frappeApi.get(`/api/resource/Material Request/${res.name}`)
    selectedReservationItems.value = detail.data.data.items || []
  } catch (err) {
    console.error('Fetch detail error:', err)
  }
}

const approveDraft = async (res) => {
  if (!confirm('지점장 승인(2차 DRAFT)을 진행하시겠습니까?')) return
  try {
    await frappeApi.put(`/api/resource/Material Request/${res.name}`, {
      custom_approval_stage: '지점장 승인'
    })
    alert('승인되었습니다.')
    fetchReservations()
  } catch (err) {
    console.error('Approve error:', err)
    alert('승인 중 오류가 발생했습니다.')
  }
}

const editReservation = (res) => {
  emit('edit-reservation', res.name)
}

const cancelReservation = async (res) => {
  if (!confirm(`예약(${res.name})을 정말 삭제하시겠습니까?`)) return
  try {
    await frappeApi.delete(`/api/resource/Material Request/${res.name}`)
    alert('삭제되었습니다.')
    fetchReservations()
  } catch (err) {
    console.error('Delete error:', err)
    alert('삭제 중 오류가 발생했습니다.')
  }
}

watch([statusFilter, searchQuery], () => applyFilters())

onMounted(() => {
  fetchReservations()
})
</script>

<style scoped>
.reservation-list-container { display: flex; flex-direction: column; height: 100%; font-family: var(--sans, sans-serif); background: #f8fafc; padding: 15px; overflow-y: auto; }
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.header-actions h2 { margin: 0; font-size: 20px; color: #0f172a; }
.btn-create { background: #3b82f6; color: white; border: none; padding: 10px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-create:hover { background: #2563eb; }

.filters { display: flex; gap: 10px; margin-bottom: 15px; }
.filter-input { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; }
.filter-select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; background: white; }

.table-wrapper { background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.history-table { width: 100%; border-collapse: collapse; text-align: left; }
.history-table th, .history-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; }
.history-table th { background: #f1f5f9; font-weight: bold; color: #475569; }
.clickable-row { cursor: pointer; transition: background-color 0.2s; }
.clickable-row:hover { background-color: #f8fafc; }

.res-id { color: #3b82f6; font-weight: bold; text-decoration: underline; }
.status-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
.status-default { background: #f1f5f9; color: #475569; }
.status-pending { background: #fef08a; color: #854d0e; border: 1px solid #fde047; }
.status-partial { background: #fed7aa; color: #9a3412; border: 1px solid #fdba74; }
.status-completed { background: #bbf7d0; color: #166534; border: 1px solid #86efac; }
.status-cancelled { background: #e2e8f0; color: #475569; }

.progress-bar { width: 100%; background-color: #e2e8f0; border-radius: 4px; height: 6px; margin-bottom: 4px; overflow: hidden; }
.progress-fill { background-color: #3b82f6; height: 100%; border-radius: 4px; transition: width 0.3s; }
.progress-text { font-size: 11px; font-weight: bold; color: #64748b; }

.btn-approve { background: #22c55e; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px; }
.btn-edit { background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.7; }
.btn-delete { background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.7; }
.btn-approve:hover { background: #16a34a; }
.btn-edit:hover, .btn-delete:hover { opacity: 1; transform: scale(1.1); }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; backdrop-filter: blur(2px); }
.modal-content { background: white; width: 100%; max-width: 700px; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); display: flex; flex-direction: column; max-height: 90vh; }
.modal-header { padding: 15px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 18px; color: #0f172a; }
.close-btn { background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; padding: 0; line-height: 1; }
.modal-body { padding: 20px; overflow-y: auto; }
.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
.detail-card { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
.detail-card label { display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px; }
.val { font-size: 14px; font-weight: bold; color: #334155; }
.detail-items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e2e8f0; }
.detail-items-table th, .detail-items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
.detail-items-table th { background: #f1f5f9; color: #475569; font-weight: bold; }
</style>
