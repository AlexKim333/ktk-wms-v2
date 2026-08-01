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

// 라우터 가드가 restoreSession() 을 await 하므로, 여기서 걸리면 보호 라우트가 멈춘다.
// frappeApi 인스턴스에는 기본 타임아웃이 없어(axios 기본값 0 = 무한 대기) 상한을 직접 지정한다.
const SESSION_CHECK_TIMEOUT_MS = 2500
// 프로필 해석은 요청을 여러 번 순차 호출하므로 조금 더 여유를 준다.
const PROFILE_RESOLVE_TIMEOUT_MS = 5000
// 전체 restoreSession 절대 상한. 어떤 하위 요청이 타임아웃을 무시해도 가드가 풀리게 한다.
const RESTORE_OVERALL_TIMEOUT_MS = SESSION_CHECK_TIMEOUT_MS + PROFILE_RESOLVE_TIMEOUT_MS + 1000
// 로그아웃도 상한을 둔다. 서버가 응답하지 않으면 await 가 영원히 걸린다.
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
    authEpoch: 0,
    // 동시 다중 restore 방지 (모듈 필드가 아닌 state 밖 Promise 핸들은 아래 클로저 사용)
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
    /**
     * Cookie sid가 있으면 Pinia user를 복구. 새로고침 후 /pos 유지용.
     * 반드시 resolve 한다 — 실패/타임아웃도 sessionChecked=true 로 끝낸다.
     */
    async restoreSession() {
      if (this.sessionChecked) return !!this.user
      // 이미 진행 중이면 같은 Promise 를 공유해 중복 요청/경합을 막는다.
      if (restoreInFlight) return restoreInFlight

      const epoch = this.authEpoch
      restoreInFlight = (async () => {
        try {
          return await withDeadline(runRestore(this, epoch), RESTORE_OVERALL_TIMEOUT_MS, 'restoreSession')
        } catch (error) {
          console.error('Session restore failed:', error)
          if (epoch === this.authEpoch) this.user = null
          return false
        } finally {
          this.sessionChecked = true
          restoreInFlight = null
        }
      })()

      return restoreInFlight
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
     */
    async logout() {
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

// store 인스턴스 바깥에 두어 state 직렬화/devtools 대상이 되지 않게 한다.
let restoreInFlight = null

async function runRestore(store, epoch) {
  const loggedRes = await frappeApi.get('/api/method/frappe.auth.get_logged_user', {
    timeout: SESSION_CHECK_TIMEOUT_MS
  })
  const loggedUser = loggedRes.data?.message
  if (epoch !== store.authEpoch) return false
  if (!loggedUser || loggedUser === 'Guest') {
    store.user = null
    return false
  }

  const profile = await withDeadline(
    resolveLoginProfile(frappeApi, loggedUser),
    PROFILE_RESOLVE_TIMEOUT_MS,
    'resolveLoginProfile'
  )
  // 프로필 해석은 요청을 여러 번 순차로 보내 수 초가 걸린다.
  // 그 사이 로그아웃했다면 여기서 user 를 채우면 로그아웃이 되돌려진다.
  if (epoch !== store.authEpoch) return false
  store.user = profile
  try {
    const { useBranchSessionStore } = await import('./branchSession.js')
    useBranchSessionStore().initForUser()
  } catch (e) {
    console.warn('branchSession init failed', e)
  }
  return !!store.user
}
