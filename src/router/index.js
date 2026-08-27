import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const isMobile = () => window.innerWidth <= 768

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () =>
        isMobile()
          ? import('../views/mobile/MobileLoginView.vue')
          : import('../views/LoginView.vue')
    },
    {
      path: '/pos',
      name: 'pos',
      component: () => import('../views/PosView.vue')
    },
    { path: '/setup', name: 'setup', component: () => import('../views/SetupView.vue') },
    {
      path: '/product/:id',
      name: 'product-detail',
      component: () => import('../views/ProductDetailView.vue')
    },
    {
      path: '/samdori-test',
      name: 'samdori-test',
      component: () => import('../views/SamdoriTestView.vue')
    },
    { path: '/', redirect: '/login' }
  ]
})

/**
 * 로그인 화면은 세션 복구를 기다리지 않는다.
 * beforeEach 에서 restoreSession() 을 await 하면 네트워크가 느리거나
 * 프로필 해석이 길어질 때 /login 자체가 흰 화면으로 남는다.
 */
function kickBackgroundSessionRestore(authStore) {
  if (authStore.sessionChecked || authStore.loggingOut) return
  authStore
    .restoreSession()
    .then((ok) => {
      if (!ok || !authStore.user || authStore.loggingOut) return
      // 이미 로그인 화면을 보고 있는 사용자에게만 자동 진입
      if (router.currentRoute.value.path === '/login' || router.currentRoute.value.path === '/') {
        router.replace('/pos')
      }
    })
    .catch((e) => {
      console.warn('Background session restore failed:', e)
    })
}

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // 1) 공개 라우트 (로그인 화면): 즉시 렌더. 세션 복구는 백그라운드.
  if (to.path === '/login' || to.path === '/') {
    if (authStore.loggingOut) return true
    if (authStore.user) return '/pos'
    kickBackgroundSessionRestore(authStore)
    return true
  }

  // 2) 보호 라우트: 세션 확인이 필요하면 기다린다 (상한은 auth.restoreSession 내부).
  if (!authStore.sessionChecked) {
    await authStore.restoreSession()
  }

  // 로그인되지 않은 경우 모든 보호 라우트는 /login으로 리다이렉트
  if (!authStore.user) {
    return '/login'
  }

  // 3) 관리자 전용 라우트 접근 제어
  if (to.path === '/setup' && !authStore.isAdmin) {
    return '/pos'
  }
})

export default router
