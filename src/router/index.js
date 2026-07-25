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

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.sessionChecked) {
    await authStore.restoreSession()
  }

  if (to.path === '/pos' && !authStore.user) {
    return '/login'
  }

  // 이미 로그인된 상태에서 로그인 화면으로 가면 POS로
  // loggingOut 중에는 /login 이동을 허용 (로그아웃 깜빡임/되돌림 방지)
  if ((to.path === '/login' || to.path === '/') && authStore.user && !authStore.loggingOut) {
    return '/pos'
  }
})

export default router
