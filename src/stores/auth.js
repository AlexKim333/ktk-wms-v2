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
        await axios.post('/api/method/logout', null, { withCredentials: true })
      } catch (error) {
        console.error('로그아웃 에러:', error)
      }
      this.user = null
    }
  }
})
