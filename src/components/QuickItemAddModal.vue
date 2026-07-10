<template>
  <div class="modal-overlay" v-if="isOpen">
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ $t('quick_add.title_item') }}</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label>{{ $t('quick_add.label_item_name') }} <span class="required">*</span></label>
            <input type="text" v-model="form.item_name" required :placeholder="$t('quick_add.ph_item_name')" ref="firstInput" />
          </div>
          <div class="form-group">
            <label>{{ $t('quick_add.label_color') }}</label>
            <input type="text" v-model="form.color" :placeholder="$t('quick_add.ph_color')" />
          </div>
          <div class="form-group">
            <label>{{ $t('quick_add.label_brand') }}</label>
            <input type="text" v-model="form.brand" :placeholder="$t('quick_add.ph_brand')" />
          </div>
          <div class="form-group">
            <label>{{ $t('quick_add.label_pack_qty') }} <span class="required">*</span></label>
            <input type="number" v-model.number="form.pack_qty" required min="1" :placeholder="$t('quick_add.ph_pack_qty')" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="closeModal">{{ $t('quick_add.btn_cancel') }}</button>
            <button type="submit" class="btn-submit" :disabled="isSaving">
              {{ isSaving ? $t('quick_add.saving') : $t('quick_add.btn_add_cart') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'success'])

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const form = ref({
  item_name: '',
  color: '',
  brand: '',
  pack_qty: 1
})
const isSaving = ref(false)
const firstInput = ref(null)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { item_name: '', color: '', brand: '', pack_qty: 1 }
    nextTick(() => {
      firstInput.value?.focus()
    })
  }
})

const closeModal = () => {
  emit('close')
}

const submitForm = async () => {
  const itemName = form.value.item_name.trim().toUpperCase()
  const color = form.value.color.trim().toUpperCase()
  const packQty = form.value.pack_qty || 1

  if (!itemName) return

  isSaving.value = true
  try {
    let finalItemCode = itemName
    if (color) finalItemCode += `-${color}`
    if (packQty > 1) finalItemCode += `-${packQty}`

    const itemGroup = 'Products' // Default

    const extractedNumber = parseInt(itemName.replace(/[^0-9]/g, ''), 10) || 0

    // Item 마스터 생성
    const response = await frappeApi.post('/api/resource/Item', {
      item_code: finalItemCode,
      item_name: itemName,
      brand: form.value.brand ? form.value.brand.trim() : undefined,
      item_group: itemGroup,
      stock_uom: 'Nos',
      is_stock_item: 1,
      has_variants: 0,
      custom_color: color,
      custom_pack_qty: packQty,
      custom_grid_group_id: itemName, // 그룹화를 위해 품명 사용
      custom_name_number: extractedNumber
    })

    const newItem = response.data.data
    
    // Ensure item has needed properties for PosView
    newItem.name = newItem.name || finalItemCode;

    alert(t('quick_add.msg_item_success'))
    emit('success', newItem)
    closeModal()
  } catch (err) {
    console.error('상품 추가 에러:', err)
    if (err.response && err.response.data && err.response.data.exc) {
      let errorReason = t('quick_add.msg_unknown_err')
      try {
        const excObj = JSON.parse(err.response.data.exc)
        errorReason = excObj[0] || err.response.data.exc
      } catch (e) {
        const lines = err.response.data.exc.split('\n')
        errorReason = lines[lines.length - 2] || lines[0] || err.response.data.exc
      }

      if (err.response.data.exc.includes('DuplicateEntryError')) {
        alert(t('quick_add.msg_item_dup'))
      } else {
        alert(t('quick_add.msg_item_fail', { reason: errorReason }))
      }
    } else {
      alert(t('quick_add.msg_item_err'))
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 10000;
}
.modal-container {
  background: white;
  width: 400px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
}
.modal-header {
  background: #3b82f6;
  color: white;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 {
  margin: 0; font-size: 18px; font-weight: 600;
}
.close-btn {
  background: transparent; border: none; color: white;
  font-size: 24px; cursor: pointer;
}
.modal-body {
  padding: 20px;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block; font-weight: 600; margin-bottom: 5px; font-size: 14px; color: #334155;
}
.required {
  color: #ef4444;
}
.form-group input, .form-group select {
  width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px;
  box-sizing: border-box;
}
.form-group input:focus, .form-group select:focus {
  outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}
.modal-actions {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px;
}
.btn-cancel {
  padding: 10px 15px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer;
}
.btn-submit {
  padding: 10px 15px; border: none; background: #3b82f6; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;
}
.btn-submit:disabled {
  background: #94a3b8; cursor: not-allowed;
}
</style>
