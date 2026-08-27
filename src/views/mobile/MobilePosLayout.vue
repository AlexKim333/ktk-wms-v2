<template>
  <div class="mobile-pos-layout">
    <!-- 모바일 상단 네비게이션 바 -->
    <header class="mobile-header">
      <div class="m-logo">🏆 WMS PRO</div>
      <div class="m-user" v-if="authStore.user">
        {{ authStore.user.member_name || authStore.user.full_name }} ({{ authStore.user.branch_name ?? $t('pos.hq_label') }})
        <span v-if="!authStore.isAdmin" style="display:block; font-size:11px; font-weight:800; margin-top:2px; color:#38bdf8;">
          {{ authStore.isBranchManager ? $t('mobile.role_manager_short') : $t('mobile.role_clerk_short', { name: authStore.user?.full_name || $t('mobile.clerk_default') }) }}
        </span>
      </div>
      <button type="button" class="m-logout" :disabled="isLoggingOut" @click.stop.prevent="handleLogout">
        {{ isLoggingOut ? $t('nav.logging_out') : $t('nav.logout') }}
      </button>
    </header>

    <!-- 메인 렌더링 영역 -->
    <main class="mobile-main-content">
      <MobileBranchInventoryView 
        v-if="activeNav === 'branch-inventory'" 
        :raw-items="rawItems"
        :bin-data="binData"
        :pending-reserved="pendingReserved"
      />
      <MobileBranchPosView 
        v-else-if="activeNav === 'branch-pos' || activeNav === 'pos'" 
        ref="mobilePosViewRef"
        :raw-items="rawItems"
        :bin-data="binData"
        :pending-reserved="pendingReserved"
        :branch-list="branchList"
        @refresh-items="$emit('refresh-items')"
      />
      <MobileBranchTransferView 
        v-else-if="activeNav === 'branch-transfer'" 
        ref="mobileTransferViewRef"
        :raw-items="rawItems"
        :bin-data="binData"
        :pending-reserved="pendingReserved"
        :branch-list="branchList"
        :editing-draft-name="editingDraftName"
        @refresh-items="$emit('refresh-items')"
        @back="activeNav = 'branch-reservation'"
      />
      <MobileBranchTransferReservationList 
        v-else-if="activeNav === 'branch-reservation'" 
        :raw-items="rawItems"
        @create-new="activeNav = 'branch-transfer'"
        @edit-reservation="$emit('edit-reservation', $event); activeNav = 'branch-transfer'"
        @refresh-items="$emit('refresh-items')"
      />
      <div v-else class="mobile-not-supported">
        <p>{{ $t('mobile.not_supported') }}</p>
        <button @click="activeNav = 'branch-inventory'">{{ $t('mobile.btn_goto_inventory') }}</button>
      </div>
    </main>

    <!-- 모바일 하단 탭 바 (지점 4종 메뉴) -->
    <nav class="mobile-bottom-nav">
      <button
        v-if="authStore.isBranchManager"
        class="m-nav-item"
        :class="{ active: activeNav === 'branch-inventory' }"
        @click="setMobileNav('branch-inventory')"
      >
        🔍<br/>{{ $t('mobile.nav_inventory') }}
      </button>
      <button class="m-nav-item" :class="{ active: activeNav === 'branch-pos' || activeNav === 'pos' }" @click="setMobileNav('branch-pos')">
        🛒<br/>{{ $t('mobile.nav_outbound') }}
      </button>
      <button
        v-if="authStore.isBranchManager"
        class="m-nav-item"
        :class="{ active: activeNav === 'branch-transfer' }"
        @click="setMobileNav('branch-transfer')"
      >
        🚚<br/>{{ $t('mobile.nav_transfer') }}
      </button>
      <button
        v-if="authStore.isBranchManager"
        class="m-nav-item"
        :class="{ active: activeNav === 'branch-reservation' }"
        @click="setMobileNav('branch-reservation')"
        style="position: relative;"
      >
        📅<br/>{{ $t('mobile.nav_reservation') }}
        <span v-if="branchReservationCount > 0" class="mobile-badge">{{ branchReservationCount }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import MobileBranchInventoryView from '../../components/branch/mobile/MobileBranchInventoryView.vue'
import MobileBranchPosView from '../../components/branch/mobile/MobileBranchPosView.vue'
import MobileBranchTransferView from '../../components/branch/mobile/MobileBranchTransferView.vue'
import MobileBranchTransferReservationList from '../../components/branch/mobile/MobileBranchTransferReservationList.vue'

const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) },
  branchList: { type: Array, default: () => [] },
  editingDraftName: { type: String, default: null },
  branchReservationCount: { type: Number, default: 0 }
})

const emit = defineEmits(['refresh-items', 'edit-reservation'])

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

// 모바일에서는 기본적으로 지점 출고 화면(또는 이동)을 표시
const activeNav = ref('branch-pos')

const setMobileNav = (nav) => {
  if (authStore.isBranchClerk && nav !== 'branch-pos' && nav !== 'pos') {
    alert(t('pos.msg_err_clerk_mode'))
    return
  }
  activeNav.value = nav
}

const mobilePosViewRef = ref(null)
const mobileTransferViewRef = ref(null)

/** 음성/삼돌이 장바구니는 항상 즉시출고(branch-pos). 이동 탭에 담으면 UI와 어긋남 */
const waitForPosView = async () => {
  if (activeNav.value !== 'branch-pos' && activeNav.value !== 'pos') {
    activeNav.value = 'branch-pos'
  }
  for (let i = 0; i < 8; i++) {
    if (mobilePosViewRef.value?.addFromVoice) return mobilePosViewRef.value
    await nextTick()
  }
  return mobilePosViewRef.value
}

defineExpose({
  addFromVoice: async (prod, qty) => {
    const view = await waitForPosView()
    if (!view?.addFromVoice) {
      return { ok: false, message: '모바일 장바구니에 연결하지 못했습니다.' }
    }
    return view.addFromVoice(prod, qty)
  },
  getCartItems: async () => {
    // 조회/전송도 즉시출고 장바구니 기준 (음성과 동일)
    const view = await waitForPosView()
    if (!view?.getCartItems) return []
    view.focusCart?.()
    return view.getCartItems()
  },
  focusCart: async () => {
    const view = await waitForPosView()
    view?.focusCart?.()
  },
  submitTransfer: async () => {
    const view = await waitForPosView()
    if (!view?.submitTransfer) {
      return { ok: false, message: '전송 화면에 연결하지 못했습니다.' }
    }
    try {
      const result = await view.submitTransfer()
      // 하위가 void를 돌려도 실패로 오인하지 않도록 정규화
      if (result && typeof result === 'object' && 'ok' in result) return result
      return { ok: true }
    } catch (e) {
      console.error('Mobile submitTransfer failed:', e)
      return {
        ok: false,
        message: e?.message || 'Frappe 전송 중 오류가 발생했습니다.'
      }
    }
  }
})

const isLoggingOut = ref(false)

const handleLogout = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    // 반드시 세션 정리 먼저 — replace 후 언마운트되면 logout이 실행되지 않을 수 있음
    const serverCleared = await authStore.logout()
    if (!serverCleared) {
      alert(t('pos.msg_logout_server_failed'))
    }
    await router.replace('/login')
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<style scoped>
.mobile-pos-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #f1f5f9;
  overflow: hidden;
}

.mobile-header {
  height: 60px;
  background-color: #1e293b;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  flex-shrink: 0;
  position: relative;
  z-index: 1100;
}

.m-logo {
  font-weight: bold;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.m-user {
  flex: 1;
  min-width: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.m-logout {
  flex-shrink: 0;
  background: #ef4444;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  min-height: 36px;
  min-width: 64px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  z-index: 1101;
  position: relative;
}

.mobile-main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 70px; /* 탭 바 공간 */
}

.mobile-not-supported {
  padding: 40px 20px;
  text-align: center;
  color: #64748b;
}

.mobile-not-supported button {
  margin-top: 15px;
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
}

.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 65px;
  background-color: white;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  z-index: 1000;
}

.m-nav-item {
  flex: 1;
  height: 100%;
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 600;
  padding: 5px;
  line-height: 1.4;
}

.m-nav-item.active {
  color: #3b82f6;
}

.mobile-badge {
  position: absolute;
  top: 4px;
  right: 15%;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 5px;
  border-radius: 10px;
  min-width: 16px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
</style>
