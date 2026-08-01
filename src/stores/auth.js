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
// 로그아웃도 상한을 둔다. frappeApi 에는 기본 타임아웃이 없어서, 서버가 응답하지 않으면
// await 가 영원히 걸려 로그아웃 버튼이 아무 반응 없는 것처럼 보인다.
const LOGOUT_TIMEOUT_MS = 8000

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
    loggingOut: false,
    // 로그아웃할 때마다 증가한다. 로그아웃 전에 시작된 세션 복구가 뒤늦게 끝나
    // user 를 되살리는 것을 막기 위한 세대 표시.
    authEpoch: 0
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
      // 이 복구 작업이 시작된 시점의 세대. 아래 await 들이 끝났을 때 세대가 바뀌어 있으면
      // 그 사이 로그아웃이 있었다는 뜻이므로 결과를 버린다.
      const epoch = this.authEpoch
      try {
        const loggedRes = await frappeApi.get('/api/method/frappe.auth.get_logged_user', {
          timeout: SESSION_CHECK_TIMEOUT_MS
        })
        const loggedUser = loggedRes.data?.message
        if (epoch !== this.authEpoch) return false
        if (!loggedUser || loggedUser === 'Guest') {
          this.user = null
          this.sessionChecked = true
          return false
        }
        const profile = await withDeadline(
          resolveLoginProfile(frappeApi, loggedUser),
          PROFILE_RESOLVE_TIMEOUT_MS,
          'resolveLoginProfile'
        )
        // 프로필 해석은 요청을 여러 번 순차로 보내 수 초가 걸린다.
        // 그 사이 로그아웃했다면 여기서 user 를 채우면 로그아웃이 되돌려진다.
        if (epoch !== this.authEpoch) return false
        this.user = profile
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
        if (epoch === this.authEpoch) this.user = null
        this.sessionChecked = true
        return false
      }
    },

    /**
     * 로그아웃:
     * 1) loggingOut=true (가드가 /login 허용)
     * 2) 서버 세션 종료 시도 (상한 있음)
     * 3) 성공/실패와 무관하게 로컬 user 제거
     *
     * 호출측에서 router.replace('/login') 은 logout() 이후에 할 것
     * (모바일: 먼저 replace 하면 언마운트 후 logout이 스킵될 수 있음)
     *
     * @returns {Promise<boolean>} 서버 세션까지 확실히 끊었는지 여부.
     *   false 면 로컬은 로그아웃됐지만 sid 쿠키가 살아 있을 수 있다. 공용 기기에서 중요하다.
     */
    async logout() {
      // 응답을 기다리는 동안 버튼을 여러 번 눌러도 요청이 중복으로 나가지 않게 한다.
      // 이미 진행 중이면 그쪽 호출이 결과를 보고하므로 여기서는 경고를 중복 내지 않는다.
      if (this.loggingOut) return true
      this.loggingOut = true
      this.sessionChecked = true
      // 진행 중인 세션 복구 결과가 로그아웃을 되돌리지 못하게 세대를 올린다.
      this.authEpoch += 1

      let serverCleared = false
      try {
        await frappeApi.post('/api/method/logout', {}, { timeout: LOGOUT_TIMEOUT_MS })
        serverCleared = true
      } catch (error) {
        console.error('로그아웃 요청 실패 (로컬 세션은 정리합니다):', error?.response?.status || error?.code || error)
      } finally {
        this.user = null
        this.loggingOut = false
        try {
          const { useBranchSessionStore } = await import('./branchSession.js')
          useBranchSessionStore().reset()
        } catch (e) {}
      }
      return serverCleared
    }
  }
})
