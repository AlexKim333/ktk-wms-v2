import { defineStore } from 'pinia'
import axios from 'axios'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null // 로그인한 작업자의 출입증 정보
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    isAdmin: (state) => state.user?.roles?.includes('System Manager') || state.user?.access_level === 'Admin',
    isBranchManager: (state) => state.user?.roles?.includes('Branch Manager') || state.user?.access_level === 'Manager',
    isBranchClerk: (state) => state.user?.roles?.includes('Branch Clerk') || state.user?.access_level === 'Representative'
  },
  actions: {
    async logout() {
      try {
        // 프라페 서버에 로그아웃 신고
        await axios.post('/api/method/logout')
      } catch (error) {
        console.error('로그아웃 에러:', error)
      }
      this.user = null // 출입증 파기
    }
  }
})
