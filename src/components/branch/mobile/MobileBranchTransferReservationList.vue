<template>
  <div class="reservation-list-container">
      <div class="header-actions" style="margin-bottom: 10px;">
        <h2>{{ $t('branch.res_list.title') }}</h2>
      </div>
  
      <div class="action-buttons" style="display: flex; gap: 8px; margin-bottom: 15px;">
        <button class="btn-action outline" @click="isSummaryModalOpen = true" style="flex: 1; background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; padding: 8px 10px; cursor: pointer; color: #475569; font-size: 13px; text-align: center;">
          📦 {{ $t('branch.res_list.btn_summary', '품목별 요약') }}
        </button>
        <button class="btn-create" @click="emit('create-new')" style="flex: 1; padding: 8px 10px; font-size: 13px; text-align: center;">
          {{ $t('branch.res_list.btn_new') }}
        </button>
        <button class="btn-refresh" @click="fetchReservations" style="background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; color: #475569; padding: 8px 12px; font-size: 14px;">
          🔄
        </button>
      </div>

    <div class="table-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>{{ $t('branch.res_list.col_no') }}</th>
            <th>{{ $t('branch.res_list.col_date') }}</th>
            <th>{{ $t('branch.res_list.col_status') }}</th>
            <th>{{ $t('branch.res_list.col_total_qty') }}</th>
            <th>{{ $t('branch.res_list.col_progress') }}</th>
            <th class="action-cell">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredReservations" :key="res.name" class="clickable-row">
            <td class="res-id" @click="openDetail(res)">{{ res.name }}</td>
            <td @click="openDetail(res)">{{ res.creation ? res.creation.split(' ')[0] : (res.schedule_date || '-') }}</td>
            <td @click="openDetail(res)">
              <span class="status-badge" :class="getStatusClass(res)">{{ translateStatus(res.status, res.docstatus, res.custom_approval_stage, res.is_stock_entry) }}</span>
            </td>
            <td @click="openDetail(res)">{{ totalQtyMap[res.name] || 0 }} {{ $t('branch.transfer.lbl_unit_ea') }}</td>
            <td @click="openDetail(res)">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: getProgressPercent(res) + '%' }"></div>
              </div>
              <span class="progress-text">{{ getProgressPercent(res) }}%</span>
            </td>
            <td>
              <button v-if="userRole === 'Manager' && res.custom_approval_stage === '점원 요청' && res.docstatus === 0" class="btn-approve" @click.stop="approveDraft(res)">
                ✅ {{ $t('common.approve', 'Approve') }}
              </button>
              <button v-if="res.docstatus === 0 && !res.is_stock_entry" class="btn-edit" @click.stop="editReservation(res)" title="수정" style="margin-left:5px;">📝</button>
              <button class="btn-delete" @click.stop="cancelReservation(res)" title="삭제" style="margin-left:5px;">🗑️</button>
            </td>
          </tr>
          <tr v-if="filteredReservations.length === 0">
            <td colspan="6" style="text-align: center; padding: 30px; color: #94a3b8;">
              {{ $t('branch.res_list.empty_msg') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal -->
    <div v-if="selectedReservation" class="modal-overlay" @click.self="selectedReservation = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ $t('branch.res_list.modal_title', { name: selectedReservation.name }) }}</h3>
          <button class="close-btn" @click="selectedReservation = null">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-card">
              <label>{{ $t('branch.res_list.modal_status') }}</label>
              <div class="val">
                <span class="status-badge" style="background:#e0f2fe; color:#0369a1; padding:4px 8px; border-radius:12px; font-size:12px; font-weight:bold;">
                  {{ selectedReservation.is_stock_entry ? 'Draft(Manager Approval)' : (selectedReservation.status || 'Pending') }}
                </span>
              </div>
            </div>
            <div class="detail-card">
              <label>{{ $t('branch.res_list.col_date') }}</label>
              <div class="val">{{ selectedReservation.schedule_date || selectedReservation.creation?.split(' ')[0] }}</div>
            </div>
          </div>

          <div v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry" style="margin: 10px 0; padding: 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 13px; color: #b45309; font-weight: bold; text-align: right;">
            📦 Enter Box and Pcs quantities directly.
          </div>
          <table class="detail-items-table">
            <thead>
              <tr>
                <th :rowspan="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry ? 2 : 1">아이템 코드</th>
                <th v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry" colspan="2" style="background:#e0f2fe; text-align:center; padding: 4px;">Request Qty</th>
                <th :rowspan="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry ? 2 : 1">{{ $t('branch.res_list.modal_col_req') }}</th>
                <th :rowspan="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry ? 2 : 1">{{ $t('branch.res_list.modal_col_issued') }}</th>
                <th :rowspan="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry ? 2 : 1">{{ $t('branch.res_list.modal_col_remain') }}</th>
              </tr>
              <tr v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry">
                <th style="background:#e0f2fe; font-size: 11px; text-align:center; padding: 4px;">{{ $t('branch.transfer.th_box') }}</th>
                <th style="background:#e0f2fe; font-size: 11px; text-align:center; padding: 4px;">{{ $t('branch.transfer.th_each') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedReservationItems" :key="item.name">
                <td style="text-align: left;">
                  <div style="font-weight: bold;">{{ item.item_code }}</div>
                  <div style="font-size: 0.85em; color: #888; margin-top: 4px;">
                    {{ item.custom_color || '-' }} | {{ $t('branch.transfer.lbl_pack_info', { qty: item.custom_pack_qty || 1 }) }}
                  </div>
                </td>
                <template v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry">
                  <td style="background:#f0f9ff; text-align:center; padding: 4px;">
                    <input type="number" v-model.number="item.request_caja" @input="handleQtyChange(item)" min="0" style="width:60px; padding:4px; text-align:center; border:1px solid #bae6fd; border-radius:4px; font-weight:bold; color:#0369a1;" />
                  </td>
                  <td style="background:#f0f9ff; text-align:center; padding: 4px;">
                    <input type="number" v-model.number="item.request_pza" @input="handleQtyChange(item)" min="0" style="width:60px; padding:4px; text-align:center; border:1px solid #bae6fd; border-radius:4px; font-weight:bold; color:#0369a1;" />
                  </td>
                </template>
                <td style="font-weight:bold; color:#64748b; text-align:center;">{{ item.qty }}</td>
                <td style="font-weight:bold; color:#0ea5e9; text-align:center;">{{ Number(item.ordered_qty || item.received_qty || item.issued_qty || 0) }}</td>
                <td style="font-weight:bold; color:#ef4444; text-align:center;">{{ item.qty - Number(item.ordered_qty || item.received_qty || item.issued_qty || 0) }}</td>
              </tr>
              <tr v-if="selectedReservationItems.length === 0">
                <td :colspan="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry ? 6 : 4" style="text-align: center; padding: 15px; color: #94a3b8;">{{ $t('common.loading') }}</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
            <button @click="selectedReservation = null" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
              닫기
            </button>
            <button v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry" @click="submitPartialRequest" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;" :disabled="isSubmittingPartial">
              {{ isSubmittingPartial ? '전송 중...' : '🔥 Move entered qty to immediate outbound queue' }}
            </button>
            <button v-if="selectedReservation.is_stock_entry && selectedReservation.docstatus === 0" @click="$emit('edit-reservation', selectedReservation.name)" style="background: #0ea5e9; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
              🛒 장바구니에서 수정
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- 품목별 요약 모달 -->
    <div v-if="isSummaryModalOpen" class="modal-overlay" @click.self="isSummaryModalOpen = false">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h3>📦 Draft Items Summary</h3>
          <button class="close-btn" @click="isSummaryModalOpen = false">×</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <table class="history-table" style="margin: 0;">
            <thead>
              <tr>
                <th style="background: #f8fafc;">{{ $t('branch.inventory.col_item_name') }}</th>
                <th style="background: #f8fafc; text-align: right;">Total Box Qty</th>
                <th style="background: #f8fafc; text-align: right;">Total Pcs Qty</th>
                <th style="background: #f8fafc; text-align: right;">{{ $t('branch.res_list.col_total_qty') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in aggregatedSummaryItems" :key="item.item_code">
                <td style="font-weight: 500;">{{ item.item_code }}</td>
                <td style="text-align: right;">{{ Math.floor(item.total_qty / getPackQty(item.item_code)) || 0 }}</td>
                <td style="text-align: right;">{{ item.total_qty % getPackQty(item.item_code) || 0 }}</td>
                <td style="text-align: right; font-weight: bold; color: #0f172a;">{{ item.total_qty }}</td>
              </tr>
              <tr v-if="aggregatedSummaryItems.length === 0">
                <td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">{{ $t('branch.res_list.empty_msg') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="padding: 15px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end;">
          <button @click="isSummaryModalOpen = false" style="background: white; border: 1px solid #cbd5e1; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
            닫기
          </button>
        </div>
      </div>
    </div>
    <ReceiptPrint ref="receiptPrintRef" :receiptData="receiptPrintData" :items="receiptPrintItems" />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import ReceiptPrint from '../../ReceiptPrint.vue'
import axios from 'axios'
import frappeApi from '../../../api/frappe.js'
import { useAuthStore } from '../../../stores/auth.js'

// 임시: 권한 부여 전까지 token API 사용 (지점장 권한 설정 후 frappeApi로 복구 예정)
const adminApi = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'Authorization': `token ${import.meta.env.VITE_API_KEY}:${import.meta.env.VITE_API_SECRET}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

const authStore = useAuthStore();
const { t } = useI18n();
const userRole = computed(() => authStore.user?.access_level || 'Representative')
const emit = defineEmits(['create-new', 'edit-reservation'])

const receiptPrintRef = ref(null)
const receiptPrintData = ref({ summary: {} })
const receiptPrintItems = ref([])

const props = defineProps({
  rawItems: {
    type: Array,
    default: () => []
  }
})

const getPackQty = (itemCode) => {
  const found = props.rawItems.find(i => i.name === itemCode)
  return found?.custom_pack_qty || 1
}

const reservations = ref([])
const filteredReservations = ref([])
const selectedReservation = ref(null)
const selectedReservationItems = ref([])

const isSummaryModalOpen = ref(false)
const aggregatedSummaryItems = ref([])

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
    const [mrRes, seRes, userRes] = await Promise.all([
      frappeApi.get('/api/resource/Material Request', {
        params: {
          fields: JSON.stringify(['name', 'status', 'docstatus', 'schedule_date', 'customer', 'custom_customer', 'custom_orderer', 'set_warehouse', 'set_from_warehouse', 'material_request_type', 'custom_ordering_branch', 'custom_approval_stage', 'per_ordered', 'per_received', 'owner', 'creation']),
          filters: JSON.stringify([
            ['docstatus', 'in', [0, 1]],
            ['material_request_type', '=', 'Material Transfer'],
            ['set_warehouse', '=', branch]
          ]),
          limit_page_length: 500,
          order_by: 'creation desc'
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Stock Entry', {
        params: {
          fields: JSON.stringify(['name', 'creation', 'docstatus', 'purpose', 'from_warehouse', 'to_warehouse', 'owner', 'custom_orderer']),
          filters: JSON.stringify([
            ['docstatus', '=', 0],
            ['stock_entry_type', '=', 'Material Transfer'],
            ['to_warehouse', '=', branch]
          ]),
          limit_page_length: 500,
          order_by: 'creation desc'
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/User', {
        params: {
          fields: JSON.stringify(['name', 'full_name']),
          limit_page_length: 1000
        }
      }).catch(() => ({ data: { data: [] } }))
    ])

    const userMap = {}
    const users = userRes?.data?.data || []
    users.forEach(u => { userMap[u.name] = u.full_name })

    const mrData = mrRes.data?.data || []
    const seData = seRes.data?.data || []

    const normalizedSE = seData.map(se => ({
      ...se,
      is_stock_entry: true,
      status: 'Draft',
      schedule_date: (() => {
        try {
          const d = new Date(se.creation.replace(' ', 'T') + '+09:00');
          return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        } catch(e) { return se.creation.split(' ')[0]; }
      })(),
      set_from_warehouse: se.from_warehouse,
      set_warehouse: se.to_warehouse,
      custom_orderer: userMap[se.custom_orderer] || se.custom_orderer || userMap[se.owner] || se.owner || ''
    }))

    reservations.value = [...mrData, ...normalizedSE].sort((a, b) => new Date(b.creation) - new Date(a.creation))
    
    // 예약 총 수량 계산
    if (reservations.value.length > 0) {
      const detailPromises = reservations.value.map(r => 
        r.is_stock_entry
          ? frappeApi.get(`/api/resource/Stock Entry/${r.name}`)
          : frappeApi.get(`/api/resource/Material Request/${r.name}`)
      )
      const detailResArray = await Promise.all(detailPromises)
      
      const qtyMap = {}
      const aggItemsMap = {}
      
      detailResArray.forEach(resp => {
        const doc = resp.data.data
        if (doc && doc.items) {
          const total = doc.items.reduce((sum, item) => sum + (item.qty || 0), 0)
          qtyMap[doc.name] = total
          
          // 드래프트 Stock Entry 품목 합산
          if (doc.doctype === 'Stock Entry' && doc.docstatus === 0) {
            doc.items.forEach(item => {
              if (!aggItemsMap[item.item_code]) {
                aggItemsMap[item.item_code] = { item_code: item.item_code, total_qty: 0 }
              }
              aggItemsMap[item.item_code].total_qty += item.qty || 0
            })
          }
        }
      })
      totalQtyMap.value = qtyMap
      aggregatedSummaryItems.value = Object.values(aggItemsMap).sort((a, b) => b.total_qty - a.total_qty)
    } else {
      totalQtyMap.value = {}
      aggregatedSummaryItems.value = []
    }

    applyFilters()
  } catch (error) {
    console.error('Fetch reservations error:', error)
    alert('Failed to load reservations.')
  }
}

const translateStatus = (status, docstatus, approval_stage, is_stock_entry) => {
  if (is_stock_entry && docstatus === 0) return 'Pending Main Outbound'
  if (docstatus === 0) {
    if (approval_stage) return `Draft(${approval_stage})`
    return 'Draft'
  }
  if (docstatus === 2) return 'Cancelled'
  if (status === 'Pending' || status === 'Draft') return 'Pending'
  if (status === 'Partially Ordered') return 'Partially Ordered'
  if (status === 'Ordered') return 'Ordered'
  return status || 'Unknown'
}

const getStatusClass = (res) => {
  if (res.is_stock_entry && res.docstatus === 0) return 'status-delivering'
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
  isSubmittingPartial.value = false
  try {
    const detail = res.is_stock_entry
      ? await frappeApi.get(`/api/resource/Stock Entry/${res.name}`)
      : await frappeApi.get(`/api/resource/Material Request/${res.name}`)
      
    const items = detail.data.data.items || []
    
    // Fetch custom_pack_qty from Item master for accurate box calculation
    const itemCodes = [...new Set(items.map(i => i.item_code))]
    let packQtyMap = {}
    if (itemCodes.length > 0) {
      const itemRes = await frappeApi.get('/api/resource/Item', {
        params: {
          filters: JSON.stringify([['item_code', 'in', itemCodes]]),
          fields: JSON.stringify(['item_code', 'custom_pack_qty']),
          limit_page_length: 999
        }
      }).catch(() => ({ data: { data: [] } }))
      
      itemRes.data?.data?.forEach(i => {
        packQtyMap[i.item_code] = i.custom_pack_qty || 1
      })
    }

    selectedReservationItems.value = items.map(item => {
      const remain = item.qty - (item.ordered_qty || 0)
      return {
        ...item,
        custom_pack_qty: item.custom_pack_qty || packQtyMap[item.item_code] || 1,
        remain_qty: remain > 0 ? remain : 0,
        request_caja: 0,
        request_pza: 0,
        request_qty: 0
      }
    })
  } catch (err) {
    console.error('Fetch detail error:', err)
  }
}

const isSubmittingPartial = ref(false)

const handleQtyChange = (item) => {
  const cap = item.custom_pack_qty || 1
  let total = (item.request_caja || 0) * cap + (item.request_pza || 0)
  
  if (total > item.remain_qty) {
    alert(`Insufficient reservation qty. (Max ${item.remain_qty})`)
    total = item.remain_qty
    item.request_caja = Math.floor(total / cap)
    item.request_pza = total % cap
  }
  
  item.request_qty = total
}

const submitPartialRequest = async () => {
  const validItems = selectedReservationItems.value.filter(item => item.request_qty > 0)
  if (validItems.length === 0) {
    alert('Please enter qty first.')
    return
  }

  isSubmittingPartial.value = true
  try {
    const sePayload = {
      docstatus: 0,
      stock_entry_type: 'Material Transfer',
      purpose: 'Material Transfer',
      from_warehouse: '[MAIN] ALARCON - K',
      to_warehouse: authStore.user?.branch_name,
      custom_orderer: selectedReservation.value.custom_orderer,
      items: validItems.map(item => ({
        item_code: item.item_code,
        qty: item.request_qty,
        s_warehouse: '[MAIN] ALARCON - K',
        t_warehouse: authStore.user?.branch_name,
        uom: item.uom || 'Nos',
        conversion_factor: item.conversion_factor || 1,
        material_request: selectedReservation.value.name,
        material_request_item: item.name
      }))
    }
    
    const res = await adminApi.post('/api/resource/Stock Entry', sePayload)
    const docName = res.data.data.name
    
    let totalQtyCount = 0
    validItems.forEach(item => totalQtyCount += Number(item.request_qty || 0))
    
    const scheduleDate = new Date()
    const dateStr = scheduleDate.toISOString().split('T')[0]
    
    receiptPrintData.value = {
      title: 'Partial (Stock Entry)',
      no: docName,
      date: dateStr,
      ubicacion: authStore.user?.branch_name || '[MAIN] ALARCON - K',
      vendedor: selectedReservation.value.custom_orderer || authStore.user?.email,
      mode: 'Immediate Outbound',
      solicitante: selectedReservation.value.custom_orderer,
      creador: authStore.user?.email,
      shippingInfo: null,
      summary: { items: validItems.length, bulto: totalQtyCount, pzs: 0 }
    }
    
    receiptPrintItems.value = JSON.parse(JSON.stringify(validItems.map(item => ({
      name: item.item_code,
      item_name: item.item_name || item.item_code,
      input_box: item.request_qty,
      input_each: 0,
      price_list_rate: 0
    }))))
    
    await nextTick()
    if (receiptPrintRef.value) {
      const success = await receiptPrintRef.value.copyToClipboard()
      if (success) {
        alert(t('branch.transfer.msg_submit_success'))
      } else {
        alert(t('branch.transfer.msg_draft_success'))
      }
    } else {
      alert(t('branch.transfer.msg_draft_success'))
    }
    
    selectedReservation.value = null
    fetchReservations()
  } catch (error) {
    console.error('Partial request error:', error)
    alert(t('branch.transfer.msg_err_transfer'))
  } finally {
    isSubmittingPartial.value = false
  }
}

const approveDraft = async (res) => {
  if (!confirm(t('branch.transfer.msg_confirm_submit'))) return
  try {
    await frappeApi.put(`/api/resource/Material Request/${res.name}`, {
      custom_approval_stage: '지점장 승인'
    })
    alert(t('branch.transfer.msg_submit_success'))
    fetchReservations()
  } catch (err) {
    console.error('Approve error:', err)
    alert(t('branch.transfer.msg_err_transfer'))
  }
}

const editReservation = (res) => {
  emit('edit-reservation', res.name)
}

const cancelReservation = async (res) => {
  if (!confirm(t('branch.res_list.msg_confirm_cancel', { name: res.name }))) return
  try {
    if (res.is_stock_entry) {
      await adminApi.delete(`/api/resource/Stock Entry/${res.name}`)
    } else {
      await frappeApi.delete(`/api/resource/Material Request/${res.name}`)
    }
    alert(t('branch.res_list.msg_cancel_success'))
    fetchReservations()
  } catch (error) {
    console.error('삭제 권한 오류:', error)
    alert(t('branch.res_list.msg_cancel_error'))
  }
}



watch([statusFilter, searchQuery], () => applyFilters())

let pollInterval = null

onMounted(() => {
  fetchReservations()
  pollInterval = setInterval(fetchReservations, 10000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
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

.table-wrapper { background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow-x: auto; overflow-y: auto; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); -webkit-overflow-scrolling: touch; }
.history-table { width: 100%; border-collapse: collapse; text-align: left; }
.history-table th, .history-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; }
.history-table th { background: #f1f5f9; font-weight: bold; color: #475569; }
.clickable-row { cursor: pointer; transition: background-color 0.2s; }
.clickable-row:hover { background-color: #f8fafc; }

.res-id { color: #3b82f6; font-weight: bold; text-decoration: underline; }
.status-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; }
.status-default { background: #f1f5f9; color: #475569; }
.status-pending { background: #fef08a; color: #854d0e; border: 1px solid #fde047; }
.status-delivering { background: #dbeafe; color: #1e3a8a; border: 1px solid #bfdbfe; }
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
.detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
.detail-card { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
.detail-card label { display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px; }
.val { font-size: 14px; font-weight: bold; color: #334155; }
.detail-items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e2e8f0; }
.detail-items-table th, .detail-items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
.detail-items-table th { background: #f1f5f9; color: #475569; font-weight: bold; }

/* Hover Tooltip */
.hover-tooltip {
  position: fixed;
  background: white;
  border: 1px solid #cbd5e1;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 10px;
  z-index: 9999;
  min-width: 250px;
  transform: translateY(-100%);
  pointer-events: none;
}
</style>





