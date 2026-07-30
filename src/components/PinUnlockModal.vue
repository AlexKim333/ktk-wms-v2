<template>
  <!--
    지점장 PIN 잠금해제 모달 (프론트 전용, Frappe 무관).
    상태는 전부 branchSession 스토어가 보유하므로 props 는 variant 뿐이다.
    variant 별 마크업은 분리 이전 각 호출처의 것을 그대로 옮긴 것이다. 겉모습을 바꾸지 않기 위해 통합하지 않았다.
  -->

  <!-- desktop: PosView.vue 사이드바에서 열리는 형태 -->
  <div
    v-if="variant === 'desktop' && branchSession.pinModalOpen"
    style="position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;"
    @click.self="branchSession.closePinModal()"
  >
    <div style="background:white; border-radius:12px; width:min(380px,92vw); padding:20px; box-shadow:0 20px 50px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:18px;">{{ $t('pos.btn_pin_unlock') }}</h3>
        <button type="button" style="border:none; background:transparent; font-size:18px; cursor:pointer;" @click="branchSession.closePinModal()">✕</button>
      </div>
      <p style="font-size:13px; color:#64748b; margin:0 0 12px 0;">{{ $t('pos.pin_desc') }}</p>
      <input
        v-model="branchSession.pinInput"
        type="password"
        inputmode="numeric"
        maxlength="4"
        :placeholder="$t('pos.ph_pin')"
        style="width:100%; box-sizing:border-box; padding:12px; font-size:22px; letter-spacing:8px; text-align:center; border:1px solid #cbd5e1; border-radius:8px;"
        @keyup.enter="emit('unlock')"
      />
      <p v-if="branchSession.pinError" style="color:#ef4444; font-weight:700; margin:10px 0 0;">{{ branchSession.pinError }}</p>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button type="button" style="flex:1; padding:12px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:700; cursor:pointer;" @click="branchSession.closePinModal()">{{ $t('pos.qa_btn_cancel') }}</button>
        <button type="button" style="flex:1; padding:12px; border-radius:8px; border:none; background:#0ea5e9; color:white; font-weight:800; cursor:pointer;" @click="emit('unlock')">{{ $t('pos.btn_unlock') }}</button>
      </div>
    </div>
  </div>

  <!-- branch: BranchPosView.vue 결제 모달과 같은 껍데기를 쓰는 형태 -->
  <div
    v-else-if="variant === 'branch' && branchSession.pinModalOpen"
    class="pos-modal-overlay"
    @click.self="branchSession.closePinModal()"
  >
    <div class="pos-payment-modal" style="max-width: 380px;">
      <div class="modal-header">
        <h3>{{ $t('branch.pos.btn_pin_unlock') }}</h3>
        <button class="close-btn" @click="branchSession.closePinModal()">✕</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 13px; color: #64748b; margin: 0 0 12px 0;">
          {{ $t('branch.pos.pin_desc') }}
        </p>
        <input
          v-model="branchSession.pinInput"
          type="password"
          inputmode="numeric"
          maxlength="4"
          :placeholder="$t('branch.pos.ph_pin')"
          class="pay-input"
          style="width: 100%; font-size: 22px; letter-spacing: 8px; text-align: center;"
          @keyup.enter="emit('unlock')"
        />
        <p v-if="branchSession.pinError" style="color: #ef4444; font-weight: 700; margin-top: 10px;">
          {{ branchSession.pinError }}
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-cancel" @click="branchSession.closePinModal()">{{ $t('common.cancel_plain') }}</button>
        <button class="btn-submit-pos" @click="emit('unlock')">{{ $t('branch.pos.btn_unlock') }}</button>
      </div>
    </div>
  </div>

  <!-- mobile: MobilePosLayout.vue 형태 -->
  <div
    v-else-if="variant === 'mobile' && branchSession.pinModalOpen"
    style="position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;"
    @click.self="branchSession.closePinModal()"
  >
    <div style="background:white; border-radius:12px; width:min(380px,92vw); padding:20px;">
      <h3 style="margin:0 0 12px;">{{ $t('mobile.pin_title') }}</h3>
      <input
        v-model="branchSession.pinInput"
        type="password"
        inputmode="numeric"
        maxlength="4"
        :placeholder="$t('branch.pos.ph_pin')"
        style="width:100%; box-sizing:border-box; padding:12px; font-size:22px; letter-spacing:8px; text-align:center; border:1px solid #cbd5e1; border-radius:8px;"
        @keyup.enter="emit('unlock')"
      />
      <p v-if="branchSession.pinError" style="color:#ef4444; font-weight:700;">{{ branchSession.pinError }}</p>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button type="button" style="flex:1; padding:12px;" @click="branchSession.closePinModal()">{{ $t('common.cancel_plain') }}</button>
        <button type="button" style="flex:1; padding:12px; background:#0ea5e9; color:white; border:none; border-radius:8px; font-weight:800;" @click="emit('unlock')">{{ $t('branch.pos.btn_unlock') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useBranchSessionStore } from '../stores/branchSession.js'

defineProps({
  variant: {
    type: String,
    default: 'branch',
    validator: (v) => ['desktop', 'branch', 'mobile'].includes(v)
  }
})

const emit = defineEmits(['unlock'])

const branchSession = useBranchSessionStore()
</script>

<style scoped>
/* branch variant 전용. BranchPosView.vue 의 결제 모달 껍데기 스타일을 그대로 옮긴 것이다. */
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
.pay-input {
  width: 160px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  font-size: 16px;
  font-weight: 700;
  text-align: right;
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
</style>
