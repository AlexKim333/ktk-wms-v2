<template>
  <div class="modal-overlay" v-if="isOpen" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div class="product-title">
          Selected Grid Item: <strong>{{ activeGroup?.group_name }}</strong>
        </div>
        <button class="submit-btn" @click="handleSubmit">
          {{ $t('mobile.btn_done', '확인 (담기)') }}
        </button>
      </div>

      <div class="table-container">
        <table class="grid-table">
          <thead>
            <tr>
              <th>{{ $t('branch.transfer.th_item_color', '품명(컬러)') }}</th>
              <th colspan="2">{{ $t('branch.transfer.th_qty_input', '수량 입력 (Box / EA)') }}</th>
              <th>{{ $t('branch.transfer.th_total_qty', '총 수량') }}</th>
              <th>Current Stock</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(v, idx) in activeGroup?.variants" :key="idx">
              <td class="color-name">
                <strong>{{ v.custom_color || $t('common.default', 'Default') }}</strong>
                <span class="pack-badge">({{ v.custom_pack_qty || 1 }}入)</span>
              </td>
              <td class="input-cell">
                <div class="input-green">
                  <input type="number" min="0" v-model.number="v.input_box" placeholder="0" />
                </div>
              </td>
              <td class="input-cell">
                <div class="input-green">
                  <input type="number" min="0" v-model.number="v.input_each" placeholder="0" />
                </div>
              </td>
              <td class="calc-total-qty">
                <strong>{{ calculateRowTotal(v) }} EA</strong>
              </td>
              <td class="stock-info-cell">
                {{ getFormattedStockFor(v) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-footer">
        <button class="close-btn" @click="$emit('close')">
          {{ $t('mobile.btn_close', '닫기') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  activeGroup: { type: Object, default: () => null },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'submit'])

const calculateRowTotal = (v) => {
  const box = Number(v.input_box) || 0
  const each = Number(v.input_each) || 0
  const pack = Number(v.custom_pack_qty || 1)
  return (box * pack) + each
}

const getStock = (itemCode, warehouse) => {
  if (!warehouse) return 0
  const actual = Number(props.binData?.[itemCode]?.[warehouse] || 0)
  const reserved = Number(props.pendingReserved?.[warehouse]?.[itemCode] || 0)
  return actual - reserved
}

const getFormattedStockFor = (item) => {
  if (!item) return ''
  const availableQty = getStock(item.name, '[MAIN] ALARCON - K')
  const packQty = Number(item.custom_pack_qty || 1)
  const boxes = Math.floor(availableQty / packQty)
  const eaches = availableQty % packQty
  return `📦 ${boxes} Box / ${eaches} ${t('branch.transfer.lbl_unit_ea', 'EA')}`
}

const handleSubmit = () => {
  if (!props.activeGroup) {
    emit('close')
    return
  }
  const selectedVariants = props.activeGroup.variants.filter(v => 
    Number(v.input_box) > 0 || Number(v.input_each) > 0
  )
  if (selectedVariants.length === 0) {
    emit('close')
    return
  }
  emit('submit', selectedVariants)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999999;
  backdrop-filter: blur(4px);
}
.modal-content {
  background: white;
  width: 95%;
  max-width: 700px;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.product-title {
  font-size: 16px;
  color: #0f172a;
}
.product-title strong {
  font-size: 18px;
  color: #0284c7;
}
.submit-btn {
  background: #00e676;
  border: none;
  padding: 9px 22px;
  border-radius: 6px;
  font-weight: 700;
  color: #064e3b;
  cursor: pointer;
  transition: all 0.15s;
}
.submit-btn:hover {
  background: #00c853;
  color: white;
}
.table-container {
  max-height: 60vh;
  overflow-y: auto;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  margin-bottom: 16px;
}
.grid-table {
  width: 100%;
  border-collapse: collapse;
}
.grid-table th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  padding: 12px 10px;
  font-size: 13px;
  color: #334155;
  border-bottom: 2px solid #cbd5e1;
  z-index: 2;
}
.grid-table td {
  border-bottom: 1px solid #e2e8f0;
  padding: 10px;
  vertical-align: middle;
}
.color-name {
  font-size: 14px;
  color: #1e293b;
}
.pack-badge {
  font-size: 12px;
  color: #64748b;
  margin-left: 4px;
}
.input-cell {
  width: 95px;
  text-align: center;
}
.input-green {
  background-color: #00e676;
  border-radius: 4px;
  padding: 2px;
  height: 36px;
  width: 80px;
  margin: 0 auto;
}
.input-green input {
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  outline: none;
  color: #064e3b;
}
.calc-total-qty {
  text-align: center;
  font-size: 14px;
  color: #0f172a;
}
.stock-info-cell {
  font-size: 12px;
  color: #0284c7;
  font-weight: 700;
  background-color: #f0f9ff;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
}
.close-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}
.close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}
</style>
