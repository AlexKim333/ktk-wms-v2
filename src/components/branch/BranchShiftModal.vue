<template>
  <div v-if="isOpen" class="pos-modal-overlay" @click.self="handleClose">
    <div class="shift-modal">
      <div class="modal-header">
        <h3>{{ mode === 'open' ? $t('branch.shift.modal_title_open') : $t('branch.shift.modal_title_close') }}</h3>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>

      <div class="modal-body">
        <!-- 개장 -->
        <template v-if="mode === 'open'">
          <div class="method-row">
            <label>{{ $t('branch.shift.lbl_opening_cash') }}</label>
            <input type="number" v-model.number="openingCash" min="0" class="pay-input" />
          </div>
        </template>

        <!-- 마감 -->
        <template v-else>
          <div v-if="isLoadingSummary" class="loading-notice">{{ $t('branch.shift.msg_loading_invoices') }}</div>
          <template v-else>
            <div class="notice-banner">{{ $t('branch.shift.notice_scope_owner') }}</div>
            <div class="recon-row">
              <span>{{ $t('branch.shift.lbl_period_start') }}</span>
              <span>{{ openingEntry?.period_start_date }}</span>
            </div>
            <table class="shift-table">
              <thead>
                <tr>
                  <th>{{ $t('branch.shift.col_mode') }}</th>
                  <th style="text-align:right;">{{ $t('branch.shift.col_opening') }}</th>
                  <th style="text-align:right;">{{ $t('branch.shift.col_expected') }}</th>
                  <th style="text-align:right;">{{ $t('branch.shift.col_counted') }}</th>
                  <th style="text-align:right;">{{ $t('branch.shift.col_difference') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{{ $t('branch.pos.pay_cash', '현금 (Cash)') }}</td>
                  <td style="text-align:right;">{{ formatPrice(openingCashAmount) }}</td>
                  <td style="text-align:right; font-weight:bold;">{{ formatPrice(expectedCash) }}</td>
                  <td style="text-align:right;">
                    <input type="number" v-model.number="countedCash" min="0" class="pay-input small" />
                  </td>
                  <td style="text-align:right;" :class="cashDifference !== 0 ? (cashDifference > 0 ? 'diff-over' : 'diff-short') : ''">
                    {{ formatPrice(cashDifference) }}
                  </td>
                </tr>
                <tr class="info-row">
                  <td>{{ $t('branch.pos.pay_card', '카드 (Credit/Debit Card)') }}</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;">{{ formatPrice(salesTotals['Credit Card']) }}</td>
                  <td style="text-align:right; color:#94a3b8;">{{ $t('branch.shift.lbl_not_counted') }}</td>
                  <td style="text-align:right;">-</td>
                </tr>
                <tr class="info-row">
                  <td>{{ $t('branch.pos.pay_transfer', '이체 (Transfer/SPEI)') }}</td>
                  <td style="text-align:right;">-</td>
                  <td style="text-align:right;">{{ formatPrice(salesTotals['Wire Transfer']) }}</td>
                  <td style="text-align:right; color:#94a3b8;">{{ $t('branch.shift.lbl_not_counted') }}</td>
                  <td style="text-align:right;">-</td>
                </tr>
              </tbody>
            </table>
          </template>
        </template>

        <div v-if="errorMsg" class="error-notice">{{ errorMsg }}</div>
      </div>

      <div class="modal-footer">
        <button class="btn-cancel" @click="handleClose">{{ $t('branch.shift.btn_cancel') }}</button>
        <button
          class="btn-submit-pos"
          :disabled="isSubmitting || (mode === 'close' && isLoadingSummary)"
          @click="handleSubmit"
        >
          {{ isSubmitting ? $t('common.submitting', '전표 발행 중...') : (mode === 'open' ? $t('branch.shift.btn_confirm_open') : $t('branch.shift.btn_confirm_close')) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import frappeApi from '../../api/frappe.js'
import { useAuthStore } from '../../stores/auth.js'
import { formatPrice } from '../../utils/formatPrice.js'
import { frappeErrorMessage } from '../../utils/frappeError.js'
import { posProfileName } from '../../utils/branchPosProfile.js'
import { aggregateShiftSales } from '../../utils/branchShift.js'

const { t } = useI18n()
const authStore = useAuthStore()

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  mode: { type: String, default: 'open' }, // 'open' | 'close'
  branchName: { type: String, default: '' },
  openingEntry: { type: Object, default: null }
})

const emit = defineEmits(['close', 'opened', 'closed'])

const openingCash = ref(0)
const countedCash = ref(0)
const isSubmitting = ref(false)
const isLoadingSummary = ref(false)
const errorMsg = ref('')
const salesTotals = ref({ Cash: 0, 'Credit Card': 0, 'Wire Transfer': 0 })
// props.openingEntry는 목록 조회(findOpenShiftEntry)로 얻은 요약 doc이라 자식 테이블
// (balance_details)이 없다. 마감 모달을 열 때 풀 조회로 다시 받아 여기 채운다.
const fullOpeningEntry = ref(null)

const canManage = computed(() => authStore.isBranchManager || authStore.isAdmin)

const openingCashAmount = computed(() => {
  const detail = (fullOpeningEntry.value?.balance_details || []).find((d) => d.mode_of_payment === 'Cash')
  return Number(detail?.opening_amount || 0)
})

const expectedCash = computed(() => openingCashAmount.value + Number(salesTotals.value.Cash || 0))
const cashDifference = computed(() => Number(countedCash.value || 0) - expectedCash.value)

const loadClosingSummary = async () => {
  if (!props.openingEntry) return
  isLoadingSummary.value = true
  errorMsg.value = ''
  try {
    const full = await frappeApi.get(`/api/resource/POS Opening Entry/${props.openingEntry.name}`)
    fullOpeningEntry.value = full.data?.data || props.openingEntry
    // period_start_date는 브라우저 시계(UTC)로 만든 값이라 사이트 타임존(America/Mexico_City)과
    // 어긋날 수 있다. 서버가 직접 채운 creation(사이트 로컬 타임존 기준)을 기준점으로 써야
    // 방금 개장한 시프트 중 판매건이 누락되지 않는다.
    const { totals } = await aggregateShiftSales(frappeApi, {
      user: authStore.user?.member_name,
      sinceDatetime: fullOpeningEntry.value.creation || fullOpeningEntry.value.period_start_date
    })
    salesTotals.value = totals
    countedCash.value = Math.round(expectedCash.value * 100) / 100
  } finally {
    isLoadingSummary.value = false
  }
}

watch(
  () => [props.isOpen, props.mode, props.openingEntry],
  () => {
    errorMsg.value = ''
    if (!props.isOpen) return
    if (props.mode === 'open') {
      openingCash.value = 0
    } else {
      loadClosingSummary()
    }
  },
  { immediate: true }
)

const handleClose = () => {
  if (isSubmitting.value) return
  emit('close')
}

const nowDatetime = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const todayDate = () => new Date().toISOString().slice(0, 10)

const submitOpen = async () => {
  const profile = posProfileName(props.branchName)
  if (!profile) {
    throw new Error(t('branch.shift.msg_err_no_pos_profile'))
  }
  let draft
  try {
    draft = await frappeApi.post('/api/resource/POS Opening Entry', {
      doctype: 'POS Opening Entry',
      docstatus: 0,
      company: 'kecon',
      pos_profile: profile,
      user: authStore.user?.member_name,
      period_start_date: nowDatetime(),
      posting_date: todayDate(),
      balance_details: [{ mode_of_payment: 'Cash', opening_amount: Number(openingCash.value || 0) }]
    })
  } catch (err) {
    // POS Profile을 관리자가 아직 안 만들어둔 지점이면 Link 검증 오류로 여기서 걸린다.
    throw new Error(t('branch.shift.msg_err_no_pos_profile') + '\n' + frappeErrorMessage(err))
  }
  const name = draft.data?.data?.name
  const submitted = await frappeApi.put(`/api/resource/POS Opening Entry/${name}`, { docstatus: 1 })
  return submitted.data?.data
}

const submitClose = async () => {
  const payload = {
    doctype: 'POS Closing Entry',
    docstatus: 0,
    company: 'kecon',
    pos_profile: props.openingEntry.pos_profile,
    pos_opening_entry: props.openingEntry.name,
    user: authStore.user?.member_name,
    period_start_date: props.openingEntry.period_start_date,
    period_end_date: nowDatetime(),
    posting_date: todayDate(),
    payment_reconciliation: [
      {
        mode_of_payment: 'Cash',
        opening_amount: openingCashAmount.value,
        expected_amount: expectedCash.value,
        closing_amount: Number(countedCash.value || 0),
        difference: cashDifference.value
      }
    ],
    taxes: []
  }
  const draft = await frappeApi.post('/api/resource/POS Closing Entry', payload)
  const name = draft.data?.data?.name
  const submitted = await frappeApi.put(`/api/resource/POS Closing Entry/${name}`, { docstatus: 1 })
  return submitted.data?.data
}

const handleSubmit = async () => {
  if (!canManage.value) {
    errorMsg.value = t('branch.shift.msg_err_manager_only')
    return
  }
  const confirmMsg = props.mode === 'open' ? t('branch.pos.msg_cfm_open_shift') : t('branch.pos.msg_cfm_close_shift')
  if (!confirm(confirmMsg)) return

  isSubmitting.value = true
  errorMsg.value = ''
  try {
    if (props.mode === 'open') {
      const doc = await submitOpen()
      emit('opened', doc)
    } else {
      const doc = await submitClose()
      emit('closed', doc)
    }
  } catch (err) {
    console.error('Shift submit error:', err)
    errorMsg.value = err?.message || frappeErrorMessage(err)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.pos-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.shift-modal {
  width: 560px;
  max-width: 92vw;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.modal-header {
  background: #1e293b;
  color: white;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 { margin: 0; font-size: 17px; }
.close-btn { background: none; border: none; color: white; font-size: 20px; cursor: pointer; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
.method-row { display: flex; justify-content: space-between; align-items: center; }
.method-row label { font-weight: 600; font-size: 14px; color: #334155; }
.pay-input { width: 160px; padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 16px; font-weight: 700; text-align: right; }
.pay-input.small { width: 110px; padding: 6px 8px; font-size: 14px; }
.notice-banner { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-size: 12.5px; padding: 8px 12px; border-radius: 6px; }
.error-notice { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; font-size: 13px; padding: 8px 12px; border-radius: 6px; white-space: pre-wrap; }
.loading-notice { text-align: center; color: #94a3b8; padding: 20px; }
.recon-row { display: flex; justify-content: space-between; font-size: 14px; color: #475569; }
.shift-table { width: 100%; border-collapse: collapse; }
.shift-table th, .shift-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; text-align: left; }
.shift-table th { background: #f1f5f9; color: #475569; font-weight: bold; }
.info-row { color: #64748b; }
.diff-over { color: #059669; font-weight: bold; }
.diff-short { color: #ef4444; font-weight: bold; }
.modal-footer { padding: 16px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; }
.btn-cancel { padding: 10px 18px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; font-weight: 600; cursor: pointer; }
.btn-submit-pos { padding: 10px 22px; border-radius: 6px; border: none; background: #059669; color: white; font-weight: 800; cursor: pointer; font-size: 15px; }
.btn-submit-pos:disabled { background: #94a3b8; cursor: not-allowed; }
</style>
