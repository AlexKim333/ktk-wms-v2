<template>
  <div class="modal-overlay" v-if="isOpen">
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ $t('quick_add.title_customer') }}</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label>{{ $t('quick_add.label_customer_name') }} <span class="required">*</span></label>
            <input type="text" v-model="form.customer_name" required :placeholder="$t('quick_add.ph_customer_name')" ref="firstInput" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="closeModal">{{ $t('quick_add.btn_cancel') }}</button>
            <button type="submit" class="btn-submit" :disabled="isSaving">
              {{ isSaving ? $t('quick_add.saving') : $t('quick_add.btn_add_select_customer') }}
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
  customer_name: ''
})
const isSaving = ref(false)
const firstInput = ref(null)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { customer_name: '' }
    nextTick(() => {
      firstInput.value?.focus()
    })
  }
})

const closeModal = () => {
  emit('close')
}

const submitForm = async () => {
  const customerName = form.value.customer_name.trim().toUpperCase()

  if (!customerName) return

  isSaving.value = true
  try {
    const response = await frappeApi.post('/api/resource/Customer', {
      customer_name: customerName,
      customer_group: 'Commercial',
      territory: 'All Territories'
    })

    const newCustomer = response.data.data
    alert(t('quick_add.msg_customer_success'))
    emit('success', newCustomer)
    closeModal()
  } catch (err) {
    console.error('고객 추가 에러:', err)
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
        alert(t('quick_add.msg_customer_dup'))
      } else {
        alert(t('quick_add.msg_customer_fail', { reason: errorReason }))
      }
    } else {
      alert(t('quick_add.msg_customer_err'))
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
  width: 350px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
}
.modal-header {
  background: #f59e0b; /* Amber color for customer */
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
.form-group input {
  width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px;
  box-sizing: border-box;
}
.form-group input:focus {
  outline: none; border-color: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,0.2);
}
.modal-actions {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px;
}
.btn-cancel {
  padding: 10px 15px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer;
}
.btn-submit {
  padding: 10px 15px; border: none; background: #f59e0b; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;
}
.btn-submit:disabled {
  background: #94a3b8; cursor: not-allowed;
}
</style>
