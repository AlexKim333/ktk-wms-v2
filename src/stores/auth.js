import { defineStore } from 'pinia'
import frappeApi from '../api/frappe.js'
import { resolveLoginProfile } from '../composables/resolveLoginProfile.js'

function roleList(user) {
  return Array.isArray(user?.roles) ? user.roles : []
}

function hasRole(user, name) {
  const target = name.toLowerCase()
  return roleList(user).some((r) => String(r).toLowerCase() === target)
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    sessionChecked: false,
    loggingOut: false
  }),
  getters: {
    isLoggedIn: (state) => !!state.user,
    userBranch: (state) => state.user?.branch_name || '',
    // Admin이 Branch Manager 역할을 겸해도 관리자로 판정
    isAdmin: (state) =>
      state.user?.access_level === 'Admin' ||
      hasRole(state.user, 'System Manager') ||
      hasRole(state.user, 'Administrator'),
    isBranchManager: (state) => {
      if (
        state.user?.access_level === 'Admin' ||
        hasRole(state.user, 'System Manager') ||
        hasRole(state.user, 'Administrator')
      ) {
        return false
      }
      return state.user?.access_level === 'Manager' || hasRole(state.user, 'Branch Manager')
    },
    isBranchClerk: (state) => {
      if (
        state.user?.access_level === 'Admin' ||
        state.user?.access_level === 'Manager' ||
        hasRole(state.user, 'System Manager') ||
        hasRole(state.user, 'Branch Manager')
      ) {
        return false
      }
      return state.user?.access_level === 'Representative' || hasRole(state.user, 'Branch Clerk')
    }
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

    /**
     * 화면 깜빡임 없이 로그아웃:
     * 1) loggingOut=true 로 /login 이동 허용
     * 2) 서버 세션 종료
     * 3) user 제거
     */
    async logout() {
      this.loggingOut = true
      this.sessionChecked = true
      try {
        await frappeApi.post('/api/method/logout')
      } catch (error) {
        console.error('로그아웃 에러:', error)
      } finally {
        this.user = null
        this.loggingOut = false
      }
    }
  }
})
