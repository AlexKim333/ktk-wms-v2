<template>
  <div class="modal-overlay" v-if="isOpen">
    <div class="modal-container">
      <div class="modal-header">
        <h3>👤 새 응대자 퀵 추가</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label>응대자 이름 (Name) <span class="required">*</span></label>
            <input type="text" v-model="form.sales_person_name" required placeholder="예: MONSE" ref="firstInput" />
          </div>
          <div class="form-group">
            <label>담당 지점 (Branch) <span class="required">*</span></label>
            <select v-model="form.custom_branch" required>
              <option value="">지점 선택</option>
              <option v-for="branch in branchList" :key="branch.name" :value="branch.name">
                {{ branch.warehouse_name }}
              </option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="closeModal">취소</button>
            <button type="submit" class="btn-submit" :disabled="isSaving">
              {{ isSaving ? '저장 중...' : '응대자 추가 및 선택' }}
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

const props = defineProps({
  isOpen: Boolean,
  branchList: {
    type: Array,
    default: () => []
  },
  defaultBranch: {
    type: String,
    default: ''
  }
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
  sales_person_name: '',
  custom_branch: ''
})
const isSaving = ref(false)
const firstInput = ref(null)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { 
      sales_person_name: '', 
      custom_branch: props.defaultBranch || '' 
    }
    nextTick(() => {
      firstInput.value?.focus()
    })
  }
})

const closeModal = () => {
  emit('close')
}

const submitForm = async () => {
  const salesPersonName = form.value.sales_person_name.trim().toUpperCase()
  const customBranch = form.value.custom_branch

  if (!salesPersonName || !customBranch) return

  isSaving.value = true
  try {
    const response = await frappeApi.post('/api/resource/Sales Person', {
      sales_person_name: salesPersonName,
      custom_branch: customBranch,
      enabled: 1
    })

    const newSalesPerson = response.data.data
    alert('응대자가 성공적으로 등록되었습니다!');
    emit('success', newSalesPerson);
    closeModal();
  } catch (err) {
    console.error('응대자 추가 에러:', err)
    if (err.response && err.response.data && err.response.data.exc) {
      if (err.response.data.exc.includes('DuplicateEntryError')) {
        alert('이미 동일한 이름의 응대자가 존재합니다.');
      } else {
        alert('응대자 등록 중 오류가 발생했습니다. (개발자 도구 참조)');
      }
    } else {
      alert('응대자 등록 중 오류가 발생했습니다.');
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
  background: #8b5cf6; /* Purple color for sales person */
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
  outline: none; border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139,92,246,0.2);
}
.modal-actions {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px;
}
.btn-cancel {
  padding: 10px 15px; border: 1px solid #cbd5e1; background: white; border-radius: 4px; cursor: pointer;
}
.btn-submit {
  padding: 10px 15px; border: none; background: #8b5cf6; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;
}
.btn-submit:disabled {
  background: #94a3b8; cursor: not-allowed;
}
</style>
