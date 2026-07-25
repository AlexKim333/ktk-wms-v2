import { defineStore } from 'pinia'
import frappeApi from '../api/frappe.js'
import { resolveLoginProfile } from '../composables/resolveLoginProfile.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    sessionChecked: false
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    userBranch: (state) => state.user?.branch_name || '',
    isAdmin: (state) =>
      state.user?.roles?.includes('System Manager') || state.user?.access_level === 'Admin',
    isBranchManager: (state) =>
      state.user?.roles?.includes('Branch Manager') || state.user?.access_level === 'Manager',
    isBranchClerk: (state) =>
      state.user?.roles?.includes('Branch Clerk') || state.user?.access_level === 'Representative'
  },
  actions: {
    /** Cookie sid가 있으면 Pinia user를 복구. 새로고침 후 /pos 유지용 */
    async restoreSession() {
      if (this.sessionChecked) return !!this.user
      this.sessionChecked = true
      try {
        const loggedRes = await frappeApi.get('/api/method/frappe.auth.get_logged_user')
        const loggedUser = loggedRes.data?.message
        if (!loggedUser || loggedUser === 'Guest') {
          this.user = null
          return false
        }
        this.user = await resolveLoginProfile(frappeApi, loggedUser)
        return !!this.user
      } catch (error) {
        console.error('Session restore failed:', error)
        this.user = null
        return false
      }
    },

    async logout() {
      try {
        await frappeApi.post('/api/method/logout')
      } catch (error) {
        console.error('로그아웃 에러:', error)
      }
      this.user = null
      this.sessionChecked = true
    }
  }
})
