<template>
  <div class="refund-list-container">
    <div class="header-actions">
      <h2>{{ $t('branch.refund.title') }}</h2>
      <button class="btn-refresh" @click="fetchInvoices">{{ $t('branch.refund.btn_refresh') }}</button>
    </div>

    <div class="notice-banner">{{ $t('branch.refund.notice_so_dn_excluded') }}</div>

    <div class="filters">
      <input type="text" v-model="searchQuery" :placeholder="$t('branch.refund.ph_search')" class="filter-input" />
    </div>

    <div class="table-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>{{ $t('branch.refund.col_no') }}</th>
            <th>{{ $t('branch.refund.col_date') }}</th>
            <th>{{ $t('branch.refund.col_customer') }}</th>
            <th style="text-align:right;">{{ $t('branch.refund.col_total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in filteredInvoices" :key="inv.name" class="clickable-row" @click="openDetail(inv)">
            <td class="inv-id">{{ inv.name }}</td>
            <td>{{ inv.posting_date || '-' }}</td>
            <td>{{ inv.customer || '-' }}</td>
            <td style="text-align:right; font-weight:bold;">{{ formatPrice(inv.grand_total) }}</td>
          </tr>
          <tr v-if="!isLoading && filteredInvoices.length === 0">
            <td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">{{ $t('branch.refund.empty_msg') }}</td>
          </tr>
          <tr v-if="isLoading">
            <td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">{{ $t('common.loading') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail / Refund Modal -->
    <div v-if="selectedInvoice" class="modal-overlay" @click.self="closeDetail">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ $t('branch.refund.modal_title', { name: selectedInvoice.name }) }}</h3>
          <button class="close-btn" @click="closeDetail">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-card">
              <label>{{ $t('branch.refund.col_customer') }}</label>
              <div class="val">{{ selectedInvoice.customer || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>{{ $t('branch.refund.col_date') }}</label>
              <div class="val">{{ selectedInvoice.posting_date || '-' }}</div>
            </div>
            <div class="detail-card">
              <label>{{ $t('branch.refund.lbl_orig_payment') }}</label>
              <div class="val" style="font-size:12px;">
                <span v-for="p in selectedInvoice.payments || []" :key="p.mode_of_payment">{{ p.mode_of_payment }}: {{ formatPrice(p.amount) }}&nbsp;</span>
              </div>
            </div>
          </div>

          <table class="detail-items-table">
            <thead>
              <tr>
                <th>{{ $t('branch.refund.modal_col_item') }}</th>
                <th style="text-align:center;">{{ $t('branch.refund.modal_col_sold_qty') }}</th>
                <th style="text-align:center;">{{ $t('branch.refund.modal_col_refunded_qty') }}</th>
                <th style="text-align:center;">{{ $t('branch.refund.modal_col_remain_qty') }}</th>
                <th style="text-align:center;">{{ $t('branch.refund.modal_col_refund_input') }}</th>
                <th style="text-align:right;">{{ $t('branch.refund.modal_col_refund_amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedItems" :key="item.name">
                <td>{{ item.item_name || item.item_code }}</td>
                <td style="text-align:center;">{{ item.qty }}</td>
                <td style="text-align:center;">{{ item.already_refunded }}</td>
                <td style="text-align:center; font-weight:bold;">{{ item.remaining_qty }}</td>
                <td style="text-align:center;">
                  <input
                    type="number"
                    v-model.number="item.refund_qty"
                    min="0"
                    :max="item.remaining_qty"
                    :disabled="item.remaining_qty <= 0"
                    @input="handleRefundQtyChange(item)"
                    style="width:70px; padding:4px; text-align:center; border:1px solid #cbd5e1; border-radius:4px;"
                  />
                </td>
                <td style="text-align:right; font-weight:bold;">{{ formatPrice(getLineRefundAmount(item)) }}</td>
              </tr>
              <tr v-if="isLoadingDetail">
                <td colspan="6" style="text-align:center; padding:15px; color:#94a3b8;">{{ $t('common.loading') }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="hasRepricedItem" class="notice-banner" style="margin-top:10px;">{{ $t('branch.refund.notice_tier_repriced') }}</div>

          <div class="refund-payment-box">
            <div class="refund-subtotal-row">
              <span>{{ $t('branch.refund.lbl_refund_subtotal') }}</span>
              <strong>{{ formatPrice(refundSubtotal) }}</strong>
            </div>
            <label class="pay-label">{{ $t('branch.refund.lbl_refund_payment') }}</label>
            <div class="pay-inputs">
              <div class="pay-input-group">
                <span>{{ $t('branch.refund.pay_cash') }}</span>
                <input type="number" v-model.number="refundCash" min="0" @input="onPaymentEdited" />
              </div>
              <div class="pay-input-group">
                <span>{{ $t('branch.refund.pay_card') }}</span>
                <input type="number" v-model.number="refundCard" min="0" @input="onPaymentEdited" />
              </div>
              <div class="pay-input-group">
                <span>{{ $t('branch.refund.pay_transfer') }}</span>
                <input type="number" v-model.number="refundTransfer" min="0" @input="onPaymentEdited" />
              </div>
            </div>
            <div class="refund-subtotal-row">
              <span>{{ $t('branch.refund.lbl_refund_total_input') }}</span>
              <strong :class="{ mismatch: !isAmountMatched }">{{ formatPrice(totalRefundInput) }}</strong>
            </div>
          </div>

          <div style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn-secondary" @click="closeDetail">{{ $t('branch.refund.btn_close') }}</button>
            <button
              v-if="canRefund"
              class="btn-danger"
              :disabled="!canSubmitRefund || isSubmitting"
              @click="submitRefund"
            >
              {{ isSubmitting ? $t('common.loading') : $t('branch.refund.btn_confirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import frappeApi from '../../api/frappe.js'
import { useAuthStore } from '../../stores/auth.js'
import { frappeErrorMessage } from '../../utils/frappeError.js'
import { formatPrice } from '../../utils/formatPrice.js'
import { resolveItemTiers, calculateTierPrice } from '../../composables/usePriceTierEngine.js'
import { branchPriceListCandidates } from '../../utils/branchPriceList.js'

const { t } = useI18n()
const authStore = useAuthStore()
const emit = defineEmits(['refresh-items'])

const canRefund = computed(() => authStore.isBranchManager || authStore.isAdmin)

const invoices = ref([])
const filteredInvoices = ref([])
const searchQuery = ref('')
const isLoading = ref(false)

const selectedInvoice = ref(null)
const selectedItems = ref([])
const isLoadingDetail = ref(false)
const isSubmitting = ref(false)

const refundCash = ref(0)
const refundCard = ref(0)
const refundTransfer = ref(0)
const paymentManuallyEdited = ref(false)

const fetchInvoices = async () => {
  isLoading.value = true
  try {
    const res = await frappeApi.get('/api/resource/Sales Invoice', {
      params: {
        fields: JSON.stringify(['name', 'customer', 'posting_date', 'grand_total', 'docstatus', 'owner']),
        filters: JSON.stringify([
          ['is_pos', '=', 1],
          ['docstatus', '=', 1],
          ['is_return', '=', 0],
          ['company', '=', 'kecon']
        ]),
        limit_page_length: 200,
        order_by: 'posting_date desc, creation desc'
      }
    })
    invoices.value = res.data?.data || []
    applyFilter()
  } catch (err) {
    console.error('Fetch sales invoices error:', err)
    alert(t('branch.refund.msg_err_fetch'))
  } finally {
    isLoading.value = false
  }
}

const applyFilter = () => {
  if (!searchQuery.value) {
    filteredInvoices.value = invoices.value
    return
  }
  const q = searchQuery.value.toLowerCase()
  filteredInvoices.value = invoices.value.filter(
    (inv) => inv.name.toLowerCase().includes(q) || (inv.customer && inv.customer.toLowerCase().includes(q))
  )
}

const resetPaymentInputs = () => {
  refundCash.value = 0
  refundCard.value = 0
  refundTransfer.value = 0
  paymentManuallyEdited.value = false
}

const onPaymentEdited = () => {
  paymentManuallyEdited.value = true
}

const openDetail = async (inv) => {
  selectedInvoice.value = null
  selectedItems.value = []
  resetPaymentInputs()
  isLoadingDetail.value = true
  try {
    const detailRes = await frappeApi.get(`/api/resource/Sales Invoice/${inv.name}`)
    const doc = detailRes.data.data

    // 이 원본에 대해 이미 발행된 환불 전표들을 조회해 품목별 기환불 수량을 합산한다.
    const refundListRes = await frappeApi.get('/api/resource/Sales Invoice', {
      params: {
        fields: JSON.stringify(['name']),
        filters: JSON.stringify([
          ['return_against', '=', inv.name],
          ['docstatus', '=', 1],
          ['is_return', '=', 1]
        ]),
        limit_page_length: 0
      }
    }).catch(() => ({ data: { data: [] } }))

    const refundNames = (refundListRes.data?.data || []).map((r) => r.name)
    const alreadyRefundedMap = {}
    if (refundNames.length > 0) {
      const refundDocs = await Promise.all(
        refundNames.map((name) => frappeApi.get(`/api/resource/Sales Invoice/${name}`).catch(() => null))
      )
      refundDocs.forEach((r) => {
        const items = r?.data?.data?.items || []
        items.forEach((it) => {
          alreadyRefundedMap[it.item_code] = (alreadyRefundedMap[it.item_code] || 0) + Math.abs(it.qty || 0)
        })
      })
    }

    // 잔여 수량 재산정용: 품목의 포장수량(구간 산정용)과 현재 단가(4단계)를 함께 가져온다.
    // 예약 판매 시 쓰는 것과 동일한 지점 단가표 후보(본사 + 지점 전용)를 그대로 따른다.
    const itemCodes = [...new Set((doc.items || []).map((it) => it.item_code))]
    const branchName = authStore.user?.branch_name
    const priceListTargets = ['Standard Selling', ...branchPriceListCandidates(branchName)]
    const packQtyMap = {}
    const priceMap = {}
    if (itemCodes.length > 0) {
      const [itemRes, itemPriceRes] = await Promise.all([
        frappeApi
          .get('/api/resource/Item', {
            params: {
              filters: JSON.stringify([['item_code', 'in', itemCodes]]),
              fields: JSON.stringify(['item_code', 'custom_pack_qty']),
              limit_page_length: itemCodes.length
            }
          })
          .catch(() => ({ data: { data: [] } })),
        frappeApi
          .get('/api/resource/Item Price', {
            params: {
              filters: JSON.stringify([
                ['item_code', 'in', itemCodes],
                ['price_list', 'in', priceListTargets]
              ]),
              fields: JSON.stringify([
                'item_code',
                'price_list',
                'price_list_rate',
                'custom_tier_2_price',
                'custom_tier_3_price',
                'custom_tier_4_price'
              ]),
              limit_page_length: 0
            }
          })
          .catch(() => ({ data: { data: [] } }))
      ])
      ;(itemRes.data?.data || []).forEach((i) => {
        packQtyMap[i.item_code] = i.custom_pack_qty || 1
      })
      const branchLists = branchPriceListCandidates(branchName)
      ;(itemPriceRes.data?.data || []).forEach((p) => {
        if (!p.item_code) return
        const isBranchPrice = branchLists.includes(p.price_list)
        // 지점 전용 단가표가 본사(Standard Selling)보다 우선한다 (판매 시점 로직과 동일).
        if (!priceMap[p.item_code] || isBranchPrice) {
          priceMap[p.item_code] = {
            price_list_rate: Number(p.price_list_rate || 0),
            custom_tier_2_price: Number(p.custom_tier_2_price || 0),
            custom_tier_3_price: Number(p.custom_tier_3_price || 0),
            custom_tier_4_price: Number(p.custom_tier_4_price || 0)
          }
        }
      })
    }

    selectedInvoice.value = doc
    selectedItems.value = (doc.items || []).map((it) => {
      const refunded = alreadyRefundedMap[it.item_code] || 0
      const remaining = Math.max(0, (it.qty || 0) - refunded)
      return {
        ...it,
        already_refunded: refunded,
        remaining_qty: remaining,
        refund_qty: 0,
        _pack_qty: packQtyMap[it.item_code] || 1,
        _tier_price: priceMap[it.item_code] || null
      }
    })
  } catch (err) {
    console.error('Fetch invoice detail error:', err)
    alert(t('branch.refund.msg_err_fetch'))
    selectedInvoice.value = null
  } finally {
    isLoadingDetail.value = false
  }
}

const closeDetail = () => {
  selectedInvoice.value = null
  selectedItems.value = []
}

const handleRefundQtyChange = (item) => {
  let val = Number(item.refund_qty || 0)
  if (val < 0) val = 0
  if (val > item.remaining_qty) {
    alert(t('branch.refund.msg_err_qty_exceed', { max: item.remaining_qty }))
    val = item.remaining_qty
  }
  item.refund_qty = val
}

// 반품 후 고객이 실제로 보유하게 되는 수량(잔여수량)에 맞는 단가로 재계산한다.
// 예: 10개 구간가로 산 상품을 5개만 반품하면, 남는 5개는 더 이상 10개 구간 혜택 대상이
// 아니므로 그 구간의(더 비싼) 단가로 재산정해야 한다. 구간 단가가 아예 설정 안 된 품목은
// (0원) 원래 판매단가를 그대로 유지해 과다환불을 방지한다.
const getKeptUnitPrice = (item) => {
  const keptQty = Number(item.qty || 0) - Number(item.refund_qty || 0)
  if (keptQty <= 0) return 0
  const resolvedTiers = resolveItemTiers(authStore.user?.branch_name, { custom_pack_qty: item._pack_qty })
  const tierResult = calculateTierPrice(keptQty, item._tier_price, resolvedTiers)
  return tierResult.price > 0 ? tierResult.price : Number(item.rate || 0)
}

// 이 라인에서 실제로 환불해야 할 금액 = 원래 판매액 - (잔여수량 × 재산정 단가)
const getLineRefundAmount = (item) => {
  const refundQty = Number(item.refund_qty || 0)
  if (refundQty <= 0) return 0
  const originalLineTotal = Number(item.qty || 0) * Number(item.rate || 0)
  const keptQty = Number(item.qty || 0) - refundQty
  const keptValue = keptQty > 0 ? keptQty * getKeptUnitPrice(item) : 0
  return Math.max(0, originalLineTotal - keptValue)
}

const refundSubtotal = computed(() => {
  return selectedItems.value.reduce((sum, it) => sum + getLineRefundAmount(it), 0)
})

// 재산정으로 인해 "반품수량 × 원단가"와 실제 환불액이 달라진 라인이 하나라도 있는지
const hasRepricedItem = computed(() => {
  return selectedItems.value.some((it) => {
    const refundQty = Number(it.refund_qty || 0)
    if (refundQty <= 0) return false
    const naive = refundQty * Number(it.rate || 0)
    return Math.abs(getLineRefundAmount(it) - naive) > 0.01
  })
})

// 품목 수량을 조정하는 동안, 결제수단을 직접 건드리지 않았다면 현금으로 자동 맞춰준다.
watch(refundSubtotal, (val) => {
  if (!paymentManuallyEdited.value) {
    refundCash.value = Math.round(val * 100) / 100
    refundCard.value = 0
    refundTransfer.value = 0
  }
})

const totalRefundInput = computed(() => {
  return Number(refundCash.value || 0) + Number(refundCard.value || 0) + Number(refundTransfer.value || 0)
})

const isAmountMatched = computed(() => Math.abs(totalRefundInput.value - refundSubtotal.value) < 0.01)

const canSubmitRefund = computed(() => {
  const hasAnyQty = selectedItems.value.some((it) => Number(it.refund_qty || 0) > 0)
  return hasAnyQty && isAmountMatched.value
})

const submitRefund = async () => {
  if (!authStore.isBranchManager && !authStore.isAdmin) {
    alert(t('branch.refund.msg_err_manager_only'))
    return
  }
  const refundItemsPayload = selectedItems.value
    .filter((it) => Number(it.refund_qty || 0) > 0)
    .map((it) => {
      const refundQty = Number(it.refund_qty)
      // rate는 "원래 판매단가"가 아니라 "이 라인에서 실제로 돌려줘야 할 금액 ÷ 반품수량"이다.
      // 잔여수량이 구간 재산정으로 더 비싸진 만큼 반품액에서 자동으로 차감되도록 하기 위함
      // (getLineRefundAmount 참고). 재고 반영은 qty(물리 수량)로만 정확히 이뤄진다.
      const effectiveRate = getLineRefundAmount(it) / refundQty
      return {
        item_code: it.item_code,
        qty: -Math.abs(refundQty),
        rate: effectiveRate,
        warehouse: it.warehouse,
        uom: it.uom || 'Nos',
        // ERPNext는 반품 라인이 원본 전표의 어느 행을 반품하는지 이 필드로 식별한다.
        // 없으면 item_code가 일치해도 "Returned Item ... does not exist" 오류가 난다.
        sales_invoice_item: it.name
      }
    })
  if (refundItemsPayload.length === 0) {
    alert(t('branch.refund.msg_err_no_item'))
    return
  }
  if (!isAmountMatched.value) {
    alert(t('branch.refund.msg_err_amount_mismatch'))
    return
  }

  const refundPayments = [
    { mode_of_payment: 'Cash', amount: -Number(refundCash.value || 0) },
    { mode_of_payment: 'Credit Card', amount: -Number(refundCard.value || 0) },
    { mode_of_payment: 'Wire Transfer', amount: -Number(refundTransfer.value || 0) }
  ].filter((p) => p.amount !== 0)

  if (!confirm(t('branch.refund.msg_cfm_refund', { count: refundItemsPayload.length, amount: formatPrice(refundSubtotal.value) }))) {
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      doctype: 'Sales Invoice',
      docstatus: 0,
      company: 'kecon',
      is_pos: 1,
      is_return: 1,
      return_against: selectedInvoice.value.name,
      update_stock: 1,
      customer: selectedInvoice.value.customer,
      items: refundItemsPayload,
      payments: refundPayments
    }
    // draft로 먼저 생성한 뒤 submit한다: docstatus:1을 최초 POST에 바로 실어 보내면
    // 이 Frappe 인스턴스에서 GL 계정 해석이 완료되기 전에 제출이 진행되어
    // "Account is required" 오류가 난다(실측 확인됨). 기존 submitPosInvoice()도
    // 같은 단일 POST 방식이라 동일 문제에 노출돼 있을 수 있음 — 별도 보고함.
    const draftRes = await frappeApi.post('/api/resource/Sales Invoice', payload)
    const draftName = draftRes.data?.data?.name
    const res = await frappeApi.put(`/api/resource/Sales Invoice/${draftName}`, { docstatus: 1 })
    alert(t('branch.refund.msg_success', { name: res.data?.data?.name || draftName || '' }))
    closeDetail()
    fetchInvoices()
    emit('refresh-items')
  } catch (err) {
    console.error('Refund submit error:', err)
    alert(t('branch.refund.msg_err_submit', { error: frappeErrorMessage(err) }))
  } finally {
    isSubmitting.value = false
  }
}

watch(searchQuery, () => applyFilter())

onMounted(() => {
  fetchInvoices()
})
</script>

<style scoped>
.refund-list-container { display: flex; flex-direction: column; height: 100%; font-family: var(--sans, sans-serif); background: #f8fafc; padding: 15px; overflow-y: auto; }
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.header-actions h2 { margin: 0; font-size: 20px; color: #0f172a; }
.btn-refresh { padding: 10px 15px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569; }
.notice-banner { background: #fffbeb; border: 1px solid #fde68a; color: #b45309; font-size: 12.5px; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; }

.filters { display: flex; gap: 10px; margin-bottom: 15px; }
.filter-input { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; }

.table-wrapper { background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.history-table { width: 100%; border-collapse: collapse; text-align: left; }
.history-table th, .history-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; }
.history-table th { background: #f1f5f9; font-weight: bold; color: #475569; }
.clickable-row { cursor: pointer; transition: background-color 0.2s; }
.clickable-row:hover { background-color: #f8fafc; }
.inv-id { color: #3b82f6; font-weight: bold; text-decoration: underline; }

.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; backdrop-filter: blur(2px); }
.modal-content { background: white; width: 100%; max-width: 720px; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); display: flex; flex-direction: column; max-height: 90vh; }
.modal-header { padding: 15px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 17px; color: #0f172a; }
.close-btn { background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; padding: 0; line-height: 1; }
.modal-body { padding: 20px; overflow-y: auto; }
.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
.detail-card { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
.detail-card label { display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px; }
.val { font-size: 14px; font-weight: bold; color: #334155; }
.detail-items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e2e8f0; }
.detail-items-table th, .detail-items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
.detail-items-table th { background: #f1f5f9; color: #475569; font-weight: bold; }

.refund-payment-box { margin-top: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
.refund-subtotal-row { display: flex; justify-content: space-between; font-size: 14px; color: #334155; margin-bottom: 8px; }
.refund-subtotal-row strong.mismatch { color: #ef4444; }
.pay-label { display: block; font-size: 12px; font-weight: bold; color: #64748b; margin: 10px 0 6px; }
.pay-inputs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.pay-input-group { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475569; }
.pay-input-group input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; text-align: right; }

.btn-secondary { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-danger { background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-danger:disabled { background: #fca5a5; cursor: not-allowed; }
</style>
