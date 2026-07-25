<template>
  <div class="modal-overlay" v-if="isOpen">
    <div class="modal-container">
      <div class="modal-header">
        <h3>점원 추가 (빠른 등록)</h3>
        <button class="close-btn" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <form @submit.prevent="submitForm">
          <div class="form-group">
            <label>점원 이름 <span class="required">*</span></label>
            <input type="text" v-model="form.name" required placeholder="예: 홍길동" ref="firstInput" />
          </div>
          
          <div class="form-group">
            <label>전화번호 (로그인 아이디) <span class="required">*</span></label>
            <input type="text" v-model="form.phone" required placeholder="숫자만 입력 (예: 01012345678)" />
          </div>

          <div class="form-group" style="margin-top: 5px; font-size: 11.5px; color: #64748b; background: #f8fafc; padding: 10px; border-radius: 4px;">
            💡 점원은 입력하신 <b>전화번호@ktk.dummy</b> 이메일로 자동 가입되며, 초기 비밀번호는 <b>1234</b>로 설정됩니다.
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="closeModal">취소</button>
            <button type="submit" class="btn-submit" :disabled="isSaving">
              {{ isSaving ? '저장 중...' : '점원 등록하기' }}
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
import { useAuthStore } from '../stores/auth.js'

const props = defineProps({
  isOpen: { type: Boolean, required: true }
})

const emit = defineEmits(['close', 'success'])
const authStore = useAuthStore()

const firstInput = ref(null)
const isSaving = ref(false)

const form = ref({
  name: '',
  phone: ''
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value.name = ''
    form.value.phone = ''
    nextTick(() => {
      if (firstInput.value) firstInput.value.focus()
    })
  }
})

const closeModal = () => {
  emit('close')
}

const submitForm = async () => {
  isSaving.value = true
  
  // Create virtual email
  const cleanPhone = form.value.phone.replace(/[^0-9]/g, '')
  if (!cleanPhone) {
    alert('전화번호를 올바르게 입력해 주세요.')
    isSaving.value = false
    return
  }
  const email = `${cleanPhone}@ktk.dummy`
  const currentBranch = authStore.user?.branch_name

  try {
    // 1. Create User using Admin Token
    const adminApi = axios.create({
      baseURL: import.meta.env.VITE_ERPNEXT_URL,
      headers: {
        'Authorization': `token ${import.meta.env.VITE_API_KEY}:${import.meta.env.VITE_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    })

    const payload = {
      email: email,
      first_name: form.value.name,
      mobile_no: cleanPhone,
      send_welcome_email: 0,
      enabled: 1,
      user_type: 'System User',
      new_password: `Ktk@${cleanPhone}`,
      location: currentBranch, // 지점 등록
      roles: [
        { role: 'Branch Manager' },
        { role: 'Branch Clerk' }
      ]
    }

    const res = await adminApi.post('/api/resource/User', payload)

    alert(`점원 [${form.value.name}]이 성공적으로 등록되었습니다!\n로그인 ID: ${email}\n임시 비밀번호: Ktk@${cleanPhone}\n(보안상 로그인 후 비밀번호를 변경해주세요.)`)
    emit('success', { email, full_name: form.value.name })
    closeModal()
  } catch (error) {
    console.error('User Create Error:', error)
    if (error.response && error.response.data && error.response.data.exception) {
      alert(`생성 실패: 이미 존재하는 사용자이거나 오류가 발생했습니다.\n${error.response.data.exception}`)
    } else {
      alert('점원 생성 중 오류가 발생했습니다.')
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-container {
  background: white;
  width: 90%;
  max-width: 400px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  animation: modalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes modalIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
}
.modal-header h3 { margin: 0; font-size: 16px; color: #0f172a; }
.close-btn { background: none; border: none; font-size: 24px; color: #64748b; cursor: pointer; }
.close-btn:hover { color: #0f172a; }

.modal-body { padding: 20px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-weight: bold; font-size: 13px; color: #475569; }
.required { color: #ef4444; }
.form-group input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
.form-group input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
.btn-cancel { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 10px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-cancel:hover { background: #f1f5f9; }
.btn-submit { background: #3b82f6; border: none; color: white; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-submit:hover { background: #2563eb; }
.btn-submit:disabled { background: #94a3b8; cursor: not-allowed; }
</style>
