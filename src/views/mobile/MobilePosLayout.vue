<template>
  <div class="mobile-pos-layout">
    <!-- 모바일 상단 네비게이션 바 -->
    <header class="mobile-header">
      <div class="m-logo">🏆 WMS PRO</div>
      <div class="m-user" v-if="authStore.user">
        {{ authStore.user.member_name || authStore.user.full_name }} ({{ authStore.user.branch_name ?? '본부' }})
      </div>
      <button class="m-logout" @click="handleLogout">로그아웃</button>
    </header>

    <!-- 메인 렌더링 영역 -->
    <main class="mobile-main-content">
      <MobileBranchPosView 
        v-if="activeNav === 'branch-pos' || activeNav === 'pos'" 
        :raw-items="rawItems"
        :bin-data="binData"
        :pending-reserved="pendingReserved"
        :branch-list="branchList"
        @refresh-items="$emit('refresh-items')"
      />
      <MobileBranchTransferView 
        v-else-if="activeNav === 'branch-transfer'" 
        :raw-items="rawItems"
        :bin-data="binData"
        :pending-reserved="pendingReserved"
        :branch-list="branchList"
        :editing-draft-name="editingDraftName"
        @refresh-items="$emit('refresh-items')"
      />
      <MobileBranchTransferReservationList 
        v-else-if="activeNav === 'branch-reservation'" 
        :raw-items="rawItems"
        @create-new="activeNav = 'branch-transfer'"
        @edit-reservation="$emit('edit-reservation', $event)"
        @refresh-items="$emit('refresh-items')"
      />
      <div v-else class="mobile-not-supported">
        <p>이 메뉴는 모바일에서 지원되지 않습니다.</p>
        <button @click="activeNav = 'branch-pos'">지점 출고 화면으로 이동</button>
      </div>
    </main>

    <!-- 모바일 하단 탭 바 (지점 3종 메뉴) -->
    <nav class="mobile-bottom-nav">
      <button class="m-nav-item" :class="{ active: activeNav === 'branch-pos' || activeNav === 'pos' }" @click="activeNav = 'branch-pos'">
        🔍<br/>재고검색
      </button>
      <button class="m-nav-item" :class="{ active: activeNav === 'branch-transfer' }" @click="activeNav = 'branch-transfer'">
        🚚<br/>재고이동
      </button>
      <button class="m-nav-item" :class="{ active: activeNav === 'branch-reservation' }" @click="activeNav = 'branch-reservation'">
        📅<br/>예약내역
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth.js'
import MobileBranchPosView from '../../components/branch/mobile/MobileBranchPosView.vue'
import MobileBranchTransferView from '../../components/branch/mobile/MobileBranchTransferView.vue'
import MobileBranchTransferReservationList from '../../components/branch/mobile/MobileBranchTransferReservationList.vue'

const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) },
  branchList: { type: Array, default: () => [] },
  editingDraftName: { type: String, default: null }
})

const emit = defineEmits(['refresh-items', 'edit-reservation'])

const router = useRouter()
const authStore = useAuthStore()

// 모바일에서는 기본적으로 지점 출고 화면(또는 이동)을 표시
const activeNav = ref('branch-pos')

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
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
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.m-logo {
  font-weight: bold;
  font-size: 1.1rem;
}

.m-user {
  font-size: 0.85rem;
  color: #94a3b8;
}

.m-logout {
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
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
</style>
