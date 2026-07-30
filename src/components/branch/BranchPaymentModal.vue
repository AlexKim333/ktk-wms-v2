<template>
  <!-- 🌟 PAYMENT MODAL (복합 결제 및 Change 정산 모달) -->
  <div v-if="isOpen" class="pos-modal-overlay" @click.self="emit('close')">
    <div class="pos-payment-modal">
      <div class="modal-header">
        <h3>💳 {{ $t('branch.pos.title_payment', 'POS 복합 결제 및 정산') }}</h3>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="payment-grand-banner">
          <span>{{ $t('branch.pos.lbl_to_pay', '결제해야 할 금액') }}:</span>
          <strong class="grand-price">$ {{ formatPrice(grandTotal) }} MXN</strong>
        </div>
        <!-- 결제 수단 분할 입력 -->
        <div class="payment-methods-grid">
          <div class="method-row">
            <label>💵 {{ $t('branch.pos.pay_cash', '현금 (Cash)') }}</label>
            <input type="number" v-model.number="cashAmount" min="0" class="pay-input" />
          </div>
          <div class="method-row">
            <label>💳 {{ $t('branch.pos.pay_card', '카드 (Credit/Debit Card)') }}</label>
            <input type="number" v-model.number="cardAmount" min="0" class="pay-input" />
          </div>
          <div class="method-row">
            <label>🏦 {{ $t('branch.pos.pay_transfer', '이체 (Transfer/SPEI)') }}</label>
            <input type="number" v-model.number="transferAmount" min="0" class="pay-input" />
          </div>
        </div>
        <!-- 정산 결과: 총 받은 금액 / 거스름돈(Change) -->
        <div class="payment-reconciliation">
          <div class="recon-row">
            <span>{{ $t('branch.pos.lbl_total_paid', '총 입금 금액') }}:</span>
            <span>$ {{ formatPrice(totalPaid) }} MXN</span>
          </div>
          <div :class="['recon-row', changeAmount >= 0 ? 'change-ok' : 'change-short']">
            <span>{{ changeAmount >= 0 ? $t('branch.pos.lbl_change', '거스름돈 (Change)') : $t('branch.pos.lbl_shortage', '부족 금액') }}:</span>
            <strong>$ {{ formatPrice(Math.abs(changeAmount)) }} MXN</strong>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" @click="emit('close')">
          {{ $t('common.cancel_plain') }}
        </button>
        <button
          class="btn-submit-pos"
          :disabled="totalPaid < grandTotal || isSubmitting"
          @click="emit('submit')"
        >
          {{ isSubmitting ? $t('common.submitting', '전표 발행 중...') : $t('branch.pos.btn_submit_invoice', '⚡ POS Invoice 최종 발행') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatPrice } from '../../utils/formatPrice.js'

defineProps({
  isOpen: { type: Boolean, default: false },
  grandTotal: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  changeAmount: { type: Number, default: 0 },
  isSubmitting: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'submit'])

const cashAmount = defineModel('cashAmount', { type: Number, default: 0 })
const cardAmount = defineModel('cardAmount', { type: Number, default: 0 })
const transferAmount = defineModel('transferAmount', { type: Number, default: 0 })
</script>

<style scoped>
/* 🌟 PAYMENT MODAL — BranchPosView.vue 에서 그대로 이동 (겉모습 보존) */
.pos-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.pos-payment-modal {
  width: 480px;
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
.modal-header h3 {
  margin: 0;
  font-size: 17px;
}
.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
}
.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.payment-grand-banner {
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.grand-price {
  font-size: 22px;
  color: #0284c7;
}
.payment-methods-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.method-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.method-row label {
  font-weight: 600;
  font-size: 14px;
  color: #334155;
}
.pay-input {
  width: 160px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 16px;
  font-weight: 700;
  text-align: right;
}
.payment-reconciliation {
  border-top: 1px dashed #cbd5e1;
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.recon-row {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
}
.change-ok {
  color: #059669;
  font-size: 17px;
}
.change-short {
  color: #ef4444;
  font-size: 17px;
}
.modal-footer {
  padding: 16px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.btn-cancel {
  padding: 10px 18px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: white;
  font-weight: 600;
  cursor: pointer;
}
.btn-submit-pos {
  padding: 10px 22px;
  border-radius: 6px;
  border: none;
  background: #059669;
  color: white;
  font-weight: 800;
  cursor: pointer;
  font-size: 15px;
}
.btn-submit-pos:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}
</style>
