import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js' // 출입증 확인처
import LoginView from '../views/LoginView.vue'
import PosView from '../views/PosView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView },
    { path: '/pos', name: 'pos', component: PosView },
    { path: '/', redirect: '/login' }
  ]
})

// 🌟 철통 보안 문지기: 이동하기 전에 출입증(user)을 검사합니다.
router.beforeEach((to, from) => {
  const authStore = useAuthStore()
  
  if (to.path === '/pos' && !authStore.user) {
    return '/login' // 👈 next() 대신 return을 쓰면 경고창이 사라집니다!
  }
})

export default router
