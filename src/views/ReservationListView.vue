<template>
  <div class="reservation-list-container">
    <div class="header-actions">
      <h2>📅 {{ $t('reservation_list.title') }}</h2>
      <button class="btn-create" @click="$emit('create-new')">➕ {{ $t('reservation_list.btn_create') }}</button>
    </div>

    <div class="filters">
      <input type="text" v-model="searchQuery" :placeholder="$t('reservation_list.search_placeholder')" class="filter-input" />
      <select v-model="branchFilter" class="filter-select">
        <option value="all">{{ $t('reservation_list.all_branches') }}</option>
        <option v-for="branch in branchList" :key="branch.name" :value="branch.name">
          {{ branch.warehouse_name || branch.name }}
        </option>
      </select>
      <select v-model="statusFilter" class="filter-select">
        <option value="all">{{ $t('reservation_list.status_all') }}</option>
        <option value="incomplete">{{ $t('reservation_list.status_incomplete') }}</option>
        <option value="completed">{{ $t('reservation_list.status_completed') }}</option>
      </select>
    </div>

    <div class="table-wrapper">
      <table class="reservation-table">
        <thead>
          <tr>
            <th>{{ $t('reservation_list.col_res_no') }}</th>
            <th>{{ $t('reservation_list.col_date') }}</th>
            <th>{{ reservationType === 'Material Transfer' ? $t('pos.lbl_src_wh') : $t('reservation_list.col_customer') }}</th>
            <th>{{ reservationType === 'Material Transfer' ? $t('pos.lbl_tgt_wh') : $t('reservation_list.col_branch') }}</th>
            <th>{{ $t('reservation_list.col_status') }}</th>
            <th>{{ $t('reservation_list.col_total_qty') }}</th>
            <th>{{ $t('reservation_list.col_progress') }}</th>
            <th>{{ $t('reservation_list.col_cancel') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredReservations" :key="res.name" @click="openDetail(res)" class="clickable-row">
            <td class="res-id">{{ res.name }}</td>
            <td>{{ res.schedule_date }}</td>
            <td class="customer-name">
              <div>{{ reservationType === 'Material Transfer' ? (res.set_from_warehouse || '-') : (res.custom_customer || res.customer || '-') }}</div>
              <div v-if="reservationType === 'Material Transfer'" style="font-size: 11px; color: #64748b; margin-top: 2px;">
                {{ res.custom_branch_requester || res.custom_orderer || res.owner || '-' }}
              </div>
            </td>
            <td>
              <div>{{ reservationType === 'Material Transfer' ? (res.set_warehouse || '-') : (res.custom_ordering_branch || res.set_warehouse || '-') }}</div>
              <div v-if="reservationType !== 'Material Transfer'" style="font-size: 11px; color: #64748b;">
                {{ res.custom_orderer || res.owner || '-' }}
              </div>
            </td>
            <td>
              <span class="status-badge" :class="getStatusClass(res)">{{ translateStatus(res.status, res.docstatus) }}</span>
            </td>
            <td>{{ totalQtyMap[res.name] || 0 }} {{ $t('reservation_list.ea') }}</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: getProgressPercent(res) + '%' }"></div>
              </div>
              <span class="progress-text">{{ getProgressPercent(res) }}%</span>
            </td>
            <td class="action-cell" @click.stop>
              <button v-if="res.docstatus === 0" class="btn-submit" @click="submitDraft(res)" title="예약 확정(Submit)" style="background:none; border:none; cursor:pointer; font-size:1.1em; margin-right:5px;">
                ✅
              </button>
              <button class="btn-delete" @click="cancelReservation(res)" :title="res.docstatus === 0 ? '반려(삭제)' : (res.status === 'Pending' ? $t('reservation_list.btn_cancel') : $t('reservation_list.btn_terminate'))">
                🗑️
              </button>
            </td>
          </tr>
          <tr v-if="filteredReservations.length === 0">
            <td colspan="8" class="empty-msg">{{ $t('reservation_list.empty_msg') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 🌟 예약 상세 팝업 -->
    <div class="modal-overlay" v-if="selectedReservation">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ $t('reservation_list.modal_title_prefix') }}{{ selectedReservation.name }}</h3>
          <button class="close-btn" @click="selectedReservation = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-card">
              <label>{{ $t('reservation_list.modal_status') }}</label>
              <div class="val"><span class="status-badge" :class="getStatusClass(selectedReservation)">{{ translateStatus(selectedReservation.status, selectedReservation.docstatus) }}</span></div>
            </div>
            <div class="detail-card">
              <label>{{ reservationType === 'Material Transfer' ? $t('pos.lbl_src_wh') : $t('reservation_list.modal_customer') }}</label>
              <div class="val">{{ reservationType === 'Material Transfer' ? (selectedReservation.set_from_warehouse || '-') : (selectedReservation.custom_customer || selectedReservation.customer || '-') }}</div>
            </div>
            <div class="detail-card">
              <label>{{ reservationType === 'Material Transfer' ? $t('pos.lbl_tgt_wh') : $t('reservation_list.modal_manager') }}</label>
              <div class="val">
                <template v-if="reservationType === 'Material Transfer'">
                  {{ selectedReservation.set_warehouse || '-' }}
                  <div style="font-size:0.8em;color:#666;margin-top:2px;">{{ selectedReservation.custom_orderer || selectedReservation.owner || '-' }}</div>
                </template>
                <template v-else>
                  {{ selectedReservation.custom_orderer || selectedReservation.owner || '-' }}
                </template>
              </div>
            </div>
            <div class="detail-card">
              <label>{{ $t('reservation_list.modal_date') }}</label>
              <div class="val">{{ selectedReservation.schedule_date }}</div>
            </div>
          </div>
          
          <table class="detail-items-table">
            <thead>
              <tr>
                <th>{{ $t('reservation_list.modal_col_item') }}</th>
                <th>{{ $t('reservation_list.modal_col_req_qty') }}</th>
                <th>{{ $t('reservation_list.modal_col_issued') }}</th>
                <th>{{ $t('reservation_list.modal_col_remain') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedReservationItems" :key="item.name">
                <td style="text-align: left;">
                  <div style="font-weight: bold;">{{ item.item_name || item.item_code }}</div>
                  <div style="font-size: 0.85em; color: #888; margin-top: 4px;">
                    {{ getCustomColor(item.item_code) }} | 1박스 = {{ getPackQty(item.item_code) }}개
                  </div>
                </td>
                <td>{{ item.qty }}</td>
                <td style="color: #0ea5e9; font-weight: bold;">{{ Number(item.ordered_qty || item.received_qty || item.issued_qty || 0) }}</td>
                <td style="color: #ef4444; font-weight: bold;">{{ item.qty - Number(item.ordered_qty || item.received_qty || item.issued_qty || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-load-cart" @click="loadToCart" v-if="selectedReservation.status !== 'Completed' && selectedReservation.status !== 'Cancelled'">
            🛒 {{ $t('reservation_list.btn_edit') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'

const props = defineProps({
  branchList: {
    type: Array,
    default: () => []
  },
  rawItems: {
    type: Array,
    default: () => []
  },
  reservationType: {
    type: String,
    default: 'Material Issue'
  }
})

const { t } = useI18n()

const emit = defineEmits(['create-new', 'edit-reservation', 'refresh-items'])

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const getCustomColor = (itemCode) => {
  const item = props.rawItems.find(i => i.name === itemCode)
  return item ? (item.custom_color || '-') : '-'
}

const getPackQty = (itemCode) => {
  const item = props.rawItems.find(i => i.name === itemCode)
  return item ? (item.custom_pack_qty || 1) : 1
}


const reservations = ref([])
const searchQuery = ref('')
const statusFilter = ref('incomplete')
const branchFilter = ref('all')
const selectedReservation = ref(null)
const selectedReservationItems = ref([])
const totalQtyMap = ref({})

const fetchReservations = async () => {
  try {
    const [resPending, resDraft] = await Promise.all([
      frappeApi.get('/api/resource/Material Request', {
        params: {
          fields: JSON.stringify(['name', 'status', 'docstatus', 'schedule_date', 'customer', 'custom_customer', 'custom_orderer', 'custom_branch_requester', 'set_warehouse', 'set_from_warehouse', 'material_request_type', 'custom_ordering_branch', 'custom_approval_stage', 'per_ordered', 'per_received', 'owner']),
          filters: JSON.stringify([
            ['docstatus', '=', 1],
            ['material_request_type', '=', props.reservationType]
          ]),
          limit_page_length: 100,
          order_by: 'creation desc'
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Material Request', {
        params: {
          fields: JSON.stringify(['name', 'status', 'docstatus', 'schedule_date', 'customer', 'custom_customer', 'custom_orderer', 'custom_branch_requester', 'set_warehouse', 'set_from_warehouse', 'material_request_type', 'custom_ordering_branch', 'custom_approval_stage', 'per_ordered', 'per_received', 'owner']),
          filters: JSON.stringify([
            ['docstatus', '=', 0],
            ['material_request_type', '=', props.reservationType],
            ['custom_approval_stage', '=', '지점장 승인']
          ]),
          limit_page_length: 100,
          order_by: 'creation desc'
        }
      }).catch(() => ({ data: { data: [] } }))
    ])
    
    reservations.value = [...(resPending.data?.data || []), ...(resDraft.data?.data || [])]
    
    // 예약 총 수량 계산을 위해 각 예약 문서 상세 조회
    if (reservations.value.length > 0) {
      const detailPromises = reservations.value.map(r => 
        frappeApi.get(`/api/resource/Material Request/${r.name}`)
      )
      const detailResArray = await Promise.all(detailPromises)
      
      const qtyMap = {}
      detailResArray.forEach(res => {
        const doc = res.data.data
        if (doc && doc.items) {
          const total = doc.items.reduce((sum, item) => sum + (item.qty || 0), 0)
          qtyMap[doc.name] = total
        }
      })
      totalQtyMap.value = qtyMap
    } else {
      totalQtyMap.value = {}
    }
  } catch (error) {
    console.error('예약 목록 조회 에러:', error)
  }
}

let pollInterval = null

onMounted(() => {
  fetchReservations()
  pollInterval = setInterval(fetchReservations, 10000) // 10초마다 실시간 갱신(Polling)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const filteredReservations = computed(() => {
  return reservations.value.filter(res => {
    // 1. Search Filter
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || 
      (res.name && res.name.toLowerCase().includes(q)) || 
      (res.customer && res.customer.toLowerCase().includes(q))
      
    // 2. Status Filter
    let matchStatus = true
    if (statusFilter.value === 'incomplete') {
      matchStatus = res.docstatus === 0 || res.status === 'Draft' || res.status === 'Pending' || res.status === 'Partially Ordered' || res.status === 'Partially Issued' || res.status === 'Partially Received' || res.status === 'Partial'
    } else if (statusFilter.value === 'completed') {
      matchStatus = res.status === 'Completed' || res.status === 'Transferred' || res.status === 'Issued' || res.status === 'Received'
    }
    
    // 3. Branch Filter
    let matchBranch = true
    if (branchFilter.value !== 'all') {
      const resBranch = res.set_warehouse
      matchBranch = resBranch === branchFilter.value
    }
    
    return matchSearch && matchStatus && matchBranch
  })
})

const translateStatus = (status, docstatus) => {
  if (docstatus === 0) return 'Draft(지점장 승인)'
  if (docstatus === 1 && status === 'Draft') return t('status.pending') // 억까 방지: 실제로는 docstatus 1 인데 상태값이 Draft로 내려온 경우
  if (!status) return ''
  const key = 'status.' + status.toLowerCase().replace(/ /g, '_')
  const translated = t(key)
  return translated !== key ? translated : status
}

const getStatusLabel = (res) => {
  if (res.docstatus === 0) {
    if (res.custom_approval_stage) return `Draft(${res.custom_approval_stage})`
    return 'Draft'
  }
  
  if (res.docstatus === 2) return '취소됨'
  
  if (res.status === 'Pending' || res.status === 'Draft') return '대기 중'
  if (res.status === 'Partially Ordered') return '부분 주문됨'
  if (res.status === 'Ordered') return '주문 완료'
  return res.status
}

const getStatusClass = (res) => {
  if (res.docstatus === 0) return 'status-default'
  if (res.status === 'Pending' || (res.docstatus === 1 && res.status === 'Draft')) return 'status-pending'
  if (res.status.includes('Partial')) return 'status-partial'
  if (res.status === 'Completed' || res.status === 'Issued' || res.status === 'Transferred' || res.status === 'Received') return 'status-completed'
  if (res.status === 'Cancelled') return 'status-cancelled'
  return 'status-default'
}

const getProgressPercent = (res) => {
  return Math.round(res.per_ordered || res.per_received || 0)
}

const getTotalQty = (res) => {
  return totalQtyMap.value[res.name] || 0
}

const openDetail = async (res) => {
  selectedReservation.value = { ...res }
  try {
    const detail = await frappeApi.get(`/api/resource/Material Request/${res.name}`)
    // 전체 문서를 병합하여 모든 필드를 PosView로 넘겨줄 수 있게 함
    selectedReservation.value = { ...selectedReservation.value, ...detail.data.data }
    selectedReservationItems.value = detail.data.data.items || []
  } catch (err) {
    console.error('상세 조회 에러:', err)
  }
}

const loadToCart = () => {
  // 선택된 예약과 해당 아이템들을 PosView로 전달하여 장바구니 세팅
  emit('edit-reservation', {
    ...selectedReservation.value,
    items: selectedReservationItems.value
  })
  selectedReservation.value = null
}

const submitDraft = async (res) => {
  if (!confirm(`[예약 확정] 지점장이 요청한 드래프트(${res.name})를 승인(Submit)하시겠습니까?\n승인 후에는 취소 전까지 내용을 수정할 수 없습니다.`)) return
  try {
    await frappeApi.put(`/api/resource/Material Request/${res.name}`, { docstatus: 1 })
    alert('✅ 예약이 성공적으로 확정되었습니다.')
    fetchReservations()
    emit('refresh-items')
  } catch (error) {
    console.error('확정 에러:', error)
    alert('확정 처리 중 오류가 발생했습니다.')
  }
}

const cancelReservation = async (res) => {
  const isPending = res.status === 'Pending' || (res.docstatus === 1 && res.status === 'Draft');
  
  if (res.docstatus === 0 || isPending) {
    if (!confirm(t('reservation_list.msg_confirm_cancel', { name: res.name }))) return
    try {
      if (res.docstatus === 0) {
        await frappeApi.delete(`/api/resource/Material Request/${res.name}`)
      } else {
        await frappeApi.post(`/api/method/frappe.client.cancel`, {
          doctype: 'Material Request',
          name: res.name
        })
      }
      alert(t('reservation_list.msg_cancel_success'))
      fetchReservations()
      emit('refresh-items')
    } catch (error) {
      console.error('취소 에러:', error)
      alert(t('reservation_list.msg_cancel_error'))
    }
  } else {
    if (!confirm(t('reservation_list.msg_confirm_stop', { name: res.name }))) return
    try {
      await frappeApi.post(`/api/method/erpnext.stock.doctype.material_request.material_request.update_status`, {
        name: res.name,
        status: 'Stopped'
      })
      alert(t('reservation_list.msg_stop_success'))
      fetchReservations()
      emit('refresh-items')
    } catch (error) {
      console.error('중지 에러:', error)
      alert(t('reservation_list.msg_stop_error'))
    }
  }
}
</script>

<style scoped>
.reservation-list-container {
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
.reservation-table {
  width: 100%;
  border-collapse: collapse;
}
.reservation-table th, .reservation-table td {
  padding: 12px;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
}
.reservation-table th {
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
  width: 600px;
  max-width: 90%;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
  display: flex; flex-direction: column;
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
