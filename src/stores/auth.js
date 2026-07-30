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

// 라우터 가드가 restoreSession() 을 await 하므로, 여기서 걸리면 아무 화면도 렌더링되지 않는다.
// frappeApi 인스턴스에는 기본 타임아웃이 없어(axios 기본값 0 = 무한 대기) 상한을 직접 지정한다.
const SESSION_CHECK_TIMEOUT_MS = 2500
// 프로필 해석은 요청을 여러 번 순차 호출하므로 조금 더 여유를 준다.
const PROFILE_RESOLVE_TIMEOUT_MS = 5000

/** 주어진 시간 안에 끝나지 않으면 거부하여 가드가 무한 대기하지 않도록 한다. */
function withDeadline(promise, ms, label) {
  let timer
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer))
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
        const loggedRes = await frappeApi.get('/api/method/frappe.auth.get_logged_user', {
          timeout: SESSION_CHECK_TIMEOUT_MS
        })
        const loggedUser = loggedRes.data?.message
        if (!loggedUser || loggedUser === 'Guest') {
          this.user = null
          this.sessionChecked = true
          return false
        }
        this.user = await withDeadline(
          resolveLoginProfile(frappeApi, loggedUser),
          PROFILE_RESOLVE_TIMEOUT_MS,
          'resolveLoginProfile'
        )
        try {
          const { useBranchSessionStore } = await import('./branchSession.js')
          useBranchSessionStore().initForUser()
        } catch (e) {
          console.warn('branchSession init failed', e)
        }
        return !!this.user
      } catch (error) {
        // 네트워크 지연/타임아웃/서버 오류 모두 동일하게 처리한다.
        // 여기서 막히면 흰 화면이 되므로, 세션 판정을 끝낸 것으로 표시해 즉시 /login 을 렌더링하게 한다.
        console.error('Session restore failed:', error)
        this.user = null
        this.sessionChecked = true
        return false
      }
    },

    /**
     * 로그아웃 로그아웃:
     * 1) loggingOut=true (가드가 /login 허용)
     * 2) 서버 세션 종료 시도
     * 3) 로컬 user 제거
     * 호출측에서 router.replace('/login') 은 logout() 이후에 할 것
     * (모바일: 먼저 replace 하면 언마운트 후 logout이 스킵될 수 있음)
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
        try {
          const { useBranchSessionStore } = await import('./branchSession.js')
          useBranchSessionStore().reset()
        } catch (e) {}
      }
    }
  }
})
