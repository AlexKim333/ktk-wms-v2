<template>
  <div class="modal-overlay" v-if="isOpen">
    <div class="modal-content numpad-modal-content" @click.stop>
      
      <!-- 헤더 (상품 정보 및 가용 재고) -->
      <div class="numpad-header">
        <div class="item-title">
          {{ item?.item_name || item?.name }} ({{ item?.custom_color ? item.custom_color + ', ' : '' }}{{ $t('branch.transfer.lbl_pack_info', { qty: packQty }) }})
        </div>
        <div class="item-stock">
          {{ $t('mobile.lbl_avail_stock', { qty: availableStock }) }}
        </div>
      </div>

      <!-- 총 수량 계산 표시 -->
      <div class="numpad-total">
        {{ $t('mobile.lbl_total_qty') }} <strong>{{ totalQty }}</strong> 개
      </div>

      <!-- 수량 입력부 -->
      <div class="numpad-inputs">
        <!-- 박스 수량 -->
        <div class="input-row" :class="{ active: activeField === 'box' }" @click="activeField = 'box'">
          <div class="input-label">{{ $t('mobile.lbl_sel_box') }}</div>
          <div class="input-field-wrapper">
            <input type="text" readonly :value="boxValue" class="numpad-display" />
          </div>
          <div class="spinner-col">
            <button class="spin-btn up" @click.stop="changeQty('box', 1)">▲</button>
            <button class="spin-btn down" @click.stop="changeQty('box', -1)">▼</button>
          </div>
        </div>

        <!-- 낱개 수량 -->
        <div class="input-row" :class="{ active: activeField === 'each' }" @click="activeField = 'each'">
          <div class="input-label">{{ $t('mobile.lbl_sel_each') }}</div>
          <div class="input-field-wrapper">
            <input type="text" readonly :value="eachValue" class="numpad-display" />
          </div>
          <div class="spinner-col">
            <button class="spin-btn up" @click.stop="changeQty('each', 10)">▲</button>
            <button class="spin-btn down" @click.stop="changeQty('each', -10)">▼</button>
          </div>
        </div>
      </div>

      <!-- 키패드 (2x5 + 지우기) -->
      <div class="numpad-grid">
        <div class="numpad-row">
          <button v-for="n in [1,2,3,4,5]" :key="n" class="num-btn" @click="appendNum(n)">{{ n }}</button>
        </div>
        <div class="numpad-row">
          <button v-for="n in [6,7,8,9,0]" :key="n" class="num-btn" @click="appendNum(n)">{{ n }}</button>
        </div>
        <div class="numpad-row backspace-row">
          <button class="backspace-btn" @click="backspace">{{ $t('mobile.btn_backspace') }}</button>
          <button class="clear-btn" @click="clearField">{{ $t('mobile.btn_clear') }}</button>
        </div>
      </div>

      <!-- 하단 버튼 -->
      <div class="numpad-actions">
        <button 
          v-if="!isGridMode" 
          class="action-btn next-btn"
          :disabled="isNew || !hasNextItem"
          @click="submit('next')"
        >
          {{ $t('mobile.btn_next') }}
        </button>
        <button class="action-btn done-btn" @click="submit('done')">{{ $t('mobile.btn_done') }}</button>
        <button class="action-btn close-btn" @click="close">{{ $t('mobile.btn_close') }}</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n';

const { t } = useI18n();


const props = defineProps({
  isOpen: Boolean,
  item: Object,
  initialBox: { type: Number, default: 1 },
  initialEach: { type: Number, default: 0 },
  availableStock: { type: String, default: '' },
  hasNextItem: { type: Boolean, default: false },
  isNew: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'submit'])

const activeField = ref('box')
const boxValue = ref(0)
const eachValue = ref(0)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    boxValue.value = props.initialBox
    eachValue.value = props.initialEach
    activeField.value = 'box'
  }
})

const packQty = computed(() => {
  if (!props.item) return 1
  return props.item.custom_pack_qty || props.item.pack_qty || 1
})

const totalQty = computed(() => {
  return (boxValue.value * packQty.value) + eachValue.value
})

const trySetQty = (newBox, newEach) => {
  const newTotal = (newBox * packQty.value) + newEach
  const maxAllowed = props.availableStock !== '' && props.availableStock !== undefined ? Number(props.availableStock) : Infinity
  
  if (newTotal > maxAllowed) {
    boxValue.value = Math.floor(maxAllowed / packQty.value)
    eachValue.value = maxAllowed % packQty.value
  } else {
    boxValue.value = newBox
    eachValue.value = newEach
  }
}

const changeQty = (field, amount) => {
  activeField.value = field
  let newBox = boxValue.value
  let newEach = eachValue.value
  if (field === 'box') {
    newBox = Math.max(0, newBox + amount)
  } else {
    newEach = Math.max(0, newEach + amount)
  }
  trySetQty(newBox, newEach)
}

const appendNum = (num) => {
  let newBox = boxValue.value
  let newEach = eachValue.value
  if (activeField.value === 'box') {
    newBox = Number(newBox.toString() + num)
  } else {
    newEach = Number(newEach.toString() + num)
  }
  trySetQty(newBox, newEach)
}

const backspace = () => {
  if (activeField.value === 'box') {
    const str = boxValue.value.toString()
    boxValue.value = str.length > 1 ? Number(str.slice(0, -1)) : 0
  } else {
    const str = eachValue.value.toString()
    eachValue.value = str.length > 1 ? Number(str.slice(0, -1)) : 0
  }
}

const clearField = () => {
  if (activeField.value === 'box') {
    boxValue.value = 0
  } else {
    eachValue.value = 0
  }
}

const submit = (action) => {
  emit('submit', {
    item: props.item,
    box: boxValue.value,
    each: eachValue.value,
    action
  })
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex; justify-content: center; align-items: center;
  z-index: 10000;
}

.numpad-modal-content {
  background: white;
  width: 95%;
  max-width: 400px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
}

.numpad-header {
  background: #f8fafc;
  padding: 15px;
  border-bottom: 1px solid #e2e8f0;
  text-align: center;
}

.item-title {
  font-weight: 800;
  font-size: 16px;
  color: #0f172a;
  margin-bottom: 5px;
}

.item-stock {
  font-size: 14px;
  color: #ef4444;
  font-weight: bold;
}

.numpad-total {
  text-align: center;
  padding: 10px;
  font-size: 18px;
  background: #eff6ff;
  color: #1e3a8a;
  border-bottom: 1px solid #bfdbfe;
}
.numpad-total strong {
  font-size: 22px;
}

.numpad-inputs {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input-row {
  display: flex;
  align-items: center;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  padding: 5px;
  transition: all 0.2s ease;
  background: #f8fafc;
  cursor: pointer;
}
.input-row.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.input-label {
  width: 90px;
  font-size: 13px;
  font-weight: bold;
  color: #475569;
  text-align: center;
}

.input-field-wrapper {
  flex: 1;
  padding: 0 10px;
}
.numpad-display {
  width: 100%;
  font-size: 24px;
  font-weight: bold;
  text-align: right;
  border: none;
  background: transparent;
  color: #0f172a;
  outline: none;
}

.spinner-col {
  display: flex;
  flex-direction: column;
  width: 40px;
}
.spin-btn {
  background: #e2e8f0;
  border: 1px solid #cbd5e1;
  height: 25px;
  display: flex; justify-content: center; align-items: center;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
}
.spin-btn.up {
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom: none;
}
.spin-btn.down {
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}
.spin-btn:active {
  background: #cbd5e1;
}

.numpad-grid {
  padding: 15px;
  background: #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.numpad-row {
  display: flex;
  gap: 8px;
}

.num-btn {
  flex: 1;
  height: 55px;
  font-size: 24px;
  font-weight: bold;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #0f172a;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  cursor: pointer;
}
.num-btn:active {
  background: #e2e8f0;
  transform: scale(0.95);
}

.backspace-row {
  display: flex;
  gap: 8px;
}
.backspace-btn, .clear-btn {
  flex: 1;
  height: 50px;
  font-size: 18px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
}
.backspace-btn {
  background: #64748b;
}
.backspace-btn:active { background: #475569; }
.clear-btn {
  background: #ef4444;
}
.clear-btn:active { background: #dc2626; }

.numpad-actions {
  display: flex;
  border-top: 1px solid #e2e8f0;
}

.action-btn {
  flex: 1;
  padding: 15px 0;
  font-size: 16px;
  font-weight: bold;
  border: none;
  background: white;
  border-right: 1px solid #e2e8f0;
  cursor: pointer;
}
.action-btn:last-child {
  border-right: none;
}

.next-btn { color: #f59e0b; }
.next-btn:disabled { color: #cbd5e1; background: #f8fafc; cursor: not-allowed; }
.done-btn { color: #10b981; }
.close-btn { color: #64748b; }

.action-btn:active:not(:disabled) {
  background: #f1f5f9;
}
</style>
