<template>
  <div class="reservation-list-container">
    <div class="header-actions">
      <h2>📅 지점 재고이동 예약 현황</h2>
      <div style="display: flex; gap: 10px;">
        <button class="btn-action outline" @click="isSummaryModalOpen = true" style="background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; padding: 10px 15px; cursor: pointer; color: #475569;">
          📦 품목별 요약 보기
        </button>
        <button class="btn-create" @click="emit('create-new')">➕ 새 예약 작성</button>
      </div>
    </div>

    <div class="filters">
      <input type="text" v-model="searchQuery" placeholder="검색 (예약번호 등)" class="filter-input" />
      <select v-model="statusFilter" class="filter-select">
        <option value="all">모든 상태 (All)</option>
        <option value="incomplete">{{ $t('branch.res_list.status_incomplete') }}<</option>
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
            <th>{{ $t('branch.res_list.col_no') }}<</th>
            <th>날짜</th>
            <th>소스 (출발 창고)</th>
            <th>타겟 (도착 창고)</th>
            <th>{{ $t('branch.res_list.col_status') }}<</th>
            <th>{{ $t('branch.res_list.col_total_qty') }}</th>
            <th>{{ $t('branch.res_list.col_progress') }}<</th>
            <th class="action-cell">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="res in filteredReservations" :key="res.name" class="clickable-row" @mouseenter="showHover($event, res)" @mouseleave="hideHover">
            <td class="res-id" @click="openDetail(res)">{{ res.name }}</td>
            <td @click="openDetail(res)">{{ res.creation ? res.creation.split(' ')[0] : (res.schedule_date || '-') }}</td>
            <td class="customer-name" @click="openDetail(res)">
              <div>{{ res.set_from_warehouse || '-' }}</div>
            </td>
            <td @click="openDetail(res)">
              <div>{{ res.set_warehouse || '-' }}</div>
              <div style="font-size: 11.5px; color: #64748b; margin-top: 4px; font-weight: bold;">{{ res.custom_orderer || res.owner || '-' }}</div>
            </td>
            <td @click="openDetail(res)">
              <span class="status-badge" :class="getStatusClass(res)">{{ translateStatus(res.status, res.docstatus, res.custom_approval_stage, res.is_stock_entry) }}</span>
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
              <button v-if="res.docstatus === 0 && !res.is_stock_entry" class="btn-edit" @click.stop="editReservation(res)" title="수정" style="margin-left:5px;">📝</button>
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
          <div v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry" style="margin-bottom: 10px; display: flex; justify-content: flex-end;">
            <span style="font-size:12px; color:#64748b; font-weight:bold;">📦 필요한 박스(Caja) 및 낱장(Pza) 수량을 바로 입력하세요.</span>
          </div>

          <table class="detail-items-table">
            <thead>
              <tr>
                <th rowspan="2">품목 코드</th>
                <th colspan="2" style="background:#e0f2fe; text-align:center; padding: 4px;">수량 입력</th>
                <th rowspan="2">{{ $t('branch.res_list.col_total_qty') }}</th>
                <th rowspan="2">기출고</th>
                <th rowspan="2">잔여</th>
              </tr>
              <tr>
                <th style="background:#e0f2fe; font-size: 11px; text-align:center; padding: 4px;">Caja(박스)</th>
                <th style="background:#e0f2fe; font-size: 11px; text-align:center; padding: 4px;">Pza(낱장)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedReservationItems" :key="item.name">
                <td style="font-weight:bold;">{{ item.item_code }}</td>
                
                <template v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry">
                  <td style="background:#f0f9ff; text-align:center; padding: 4px;">
                    <input type="number" v-model.number="item.request_caja" @input="handleQtyChange(item)" min="0" style="width:60px; padding:4px; text-align:center; border:1px solid #bae6fd; border-radius:4px; font-weight:bold; color:#0369a1;" />
                  </td>
                  <td style="background:#f0f9ff; text-align:center; padding: 4px;">
                    <input type="number" v-model.number="item.request_pza" @input="handleQtyChange(item)" min="0" style="width:60px; padding:4px; text-align:center; border:1px solid #bae6fd; border-radius:4px; font-weight:bold; color:#0369a1;" />
                  </td>
                </template>
                <template v-else>
                  <td colspan="2" style="background:#f1f5f9; color:#94a3b8; font-size:12px; text-align:center;">수정 불가</td>
                </template>
                
                <td style="font-weight:bold; color:#64748b; text-align:center;">{{ item.qty }}</td>
                <td style="font-weight:bold; color:#059669; text-align:center;">{{ item.ordered_qty || 0 }}</td>
                <td style="font-weight:bold; color:#0ea5e9; text-align:center;">{{ item.remain_qty }}</td>
              </tr>
              <tr v-if="selectedReservationItems.length === 0">
                <td colspan="6" style="text-align: center; padding: 15px; color: #94a3b8;">데이터를 불러오는 중입니다...</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
            <button @click="selectedReservation = null" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
              닫기
            </button>
            <button v-if="selectedReservation.docstatus === 1 && !selectedReservation.is_stock_entry" @click="submitPartialRequest" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;" :disabled="isSubmittingPartial">
              {{ isSubmittingPartial ? '전송 중...' : '🔥 입력한 수량만큼 즉시 출고 대기열로 넘기기' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- 품목별 요약 모달 -->
    <div v-if="isSummaryModalOpen" class="modal-overlay" @click.self="isSummaryModalOpen = false">
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h3>📦 드래프트 품목 요약 보기</h3>
          <button class="close-btn" @click="isSummaryModalOpen = false">×</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <table class="history-table" style="margin: 0;">
            <thead>
              <tr>
                <th style="background: #f8fafc;">아이템코드</th>
                <th style="background: #f8fafc; text-align: right;">주문 박스총 수량</th>
                <th style="background: #f8fafc; text-align: right;">주문낱개총수량</th>
                <th style="background: #f8fafc; text-align: right;">주문총수량</th>
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
                <td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">진행 중인(Draft) 재고 이동 품목이 없습니다.</td>
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
    <!-- Hover Tooltip -->
    <div v-if="hoverTooltip.visible" class="hover-tooltip" :style="{ top: hoverTooltip.y + 'px', left: hoverTooltip.x + 'px' }">
      <div style="font-weight: bold; font-size: 13px; color: #3b82f6; margin-bottom: 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
        요청자: {{ hoverTooltip.data.requester }}
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="border-bottom: 1px solid #cbd5e1; color: #64748b;">
            <th style="text-align: left; padding: 2px 4px;">품목 (Color)</th>
            <th style="text-align: right; padding: 2px 4px;">Box</th>
            <th style="text-align: right; padding: 2px 4px;">낱개</th>
            <th style="text-align: right; padding: 2px 4px;">총수량</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="hoverTooltip.loading">
            <td colspan="4" style="text-align: center; padding: 10px; color: #94a3b8;">로딩 중...</td>
          </tr>
          <tr v-else-if="hoverTooltip.items.length === 0">
            <td colspan="4" style="text-align: center; padding: 10px; color: #94a3b8;">품목이 없습니다.</td>
          </tr>
          <tr v-for="item in hoverTooltip.items" :key="item.item_code">
            <td style="font-weight: 500; padding: 2px 4px;">{{ item.item_code }} ({{ item.custom_color || '-' }})</td>
            <td style="text-align: right; padding: 2px 4px;">{{ Math.floor(item.qty / getPackQty(item.item_code)) || 0 }}</td>
            <td style="text-align: right; padding: 2px 4px;">{{ Math.floor(item.qty % getPackQty(item.item_code)) || 0 }}</td>
            <td style="text-align: right; font-weight: bold; color: #0f172a; padding: 2px 4px;">{{ item.qty }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
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
    alert('예약 목록을 불러오지 못했습니다. 네트워크/권한을 확인하세요.')
  }
}

const translateStatus = (status, docstatus, approval_stage, is_stock_entry) => {
  if (is_stock_entry && docstatus === 0) return '본점 출고 대기'
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
    alert(`예약물량이 부족합니다. (최대 ${item.remain_qty}개 까지만 가능)`)
    total = item.remain_qty
    item.request_caja = Math.floor(total / cap)
    item.request_pza = total % cap
  }
  
  item.request_qty = total
}

const submitPartialRequest = async () => {
  const validItems = selectedReservationItems.value.filter(item => item.request_qty > 0)
  if (validItems.length === 0) {
    alert('요청할 수량이 없습니다. 수량을 먼저 입력해주세요.')
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
    
    await adminApi.post('/api/resource/Stock Entry', sePayload)
    alert(`성공적으로 부분 출고 요청(초안)이 생성되었습니다! 본점 대기열로 전송되었습니다.`)
    selectedReservation.value = null
    fetchReservations()
  } catch (error) {
    console.error('Partial request error:', error)
    alert('부분 출고 요청 중 오류가 발생했습니다.')
  } finally {
    isSubmittingPartial.value = false
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
    if (res.is_stock_entry) {
      await adminApi.delete(`/api/resource/Stock Entry/${res.name}`)
    } else {
      await frappeApi.delete(`/api/resource/Material Request/${res.name}`)
    }
    alert('삭제되었습니다.')
    fetchReservations()
  } catch (error) {
    console.error('삭제 권한 오류:', error)
    alert('삭제할 권한이 없거나, 이미 진행중인 예약입니다.')
  }
}

// Hover Tooltip Logic
const itemCache = ref({})
const hoverTooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  items: [],
  loading: false,
  data: {}
})

const showHover = async (event, res) => {
  const rowRect = event.currentTarget.getBoundingClientRect()
  
  hoverTooltip.value = {
    visible: true,
    x: rowRect.left,
    y: rowRect.top - 10,
    items: [],
    loading: true,
    data: { requester: res.custom_orderer || res.owner || 'Unknown' }
  }

  if (itemCache.value[res.name]) {
    hoverTooltip.value.items = itemCache.value[res.name]
    hoverTooltip.value.loading = false
    return
  }

  try {
    const detailRes = await frappeApi.get(`/api/resource/${res.is_stock_entry ? 'Stock Entry' : 'Material Request'}/${res.name}`)
    const items = detailRes.data?.data?.items || []
    itemCache.value[res.name] = items
    if (hoverTooltip.value.visible && hoverTooltip.value.data.requester === (res.custom_orderer || res.owner || 'Unknown')) {
      hoverTooltip.value.items = items
      hoverTooltip.value.loading = false
    }
  } catch (e) {
    console.error(e)
    if (hoverTooltip.value.visible) hoverTooltip.value.loading = false
  }
}

const hideHover = () => {
  hoverTooltip.value.visible = false
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
.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
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
