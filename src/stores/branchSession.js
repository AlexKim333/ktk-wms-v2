import { defineStore } from 'pinia'
import { useAuthStore } from './auth.js'

/**
 * 지점 공용 로그인 계정 위에서만 쓰는 프론트 세션 모드.
 * - clerk: 판매 보류만 (localStorage, Frappe 전송 없음)
 * - manager: PIN 통과 후 전체 기능 + 최종 판매 Frappe 전송
 * Frappe User / Role / Python 과 무관.
 */
const DEFAULT_PIN = '1111'

function branchKey(branch, prefix) {
  const b = branch || 'DEFAULT'
  return `${prefix}_${b}`
}

export const useBranchSessionStore = defineStore('branchSession', {
  state: () => ({
    /** 'clerk' | 'manager' */
    mode: 'clerk',
    /** 점원 표시명 (localStorage 명단) */
    selectedClerkName: '',
    pinModalOpen: false,
    pinInput: '',
    pinError: ''
  }),
  getters: {
    branchName: () => {
      const auth = useAuthStore()
      return auth.user?.branch_name || ''
    },
    isManagerMode: (state) => state.mode === 'manager',
    isClerkMode: (state) => state.mode === 'clerk',
    /** HQ Admin은 PIN 게이트 대상 아님 */
    needsPinGate: () => {
      const auth = useAuthStore()
      return !!auth.user && !auth.isAdmin
    },
    activeClerks() {
      try {
        const raw = localStorage.getItem(branchKey(this.branchName, 'ktk_wms_branch_clerks'))
        const list = raw ? JSON.parse(raw) : []
        if (!Array.isArray(list) || list.length === 0) {
          return [
            { id: 'c1', name: '김판매', active: true },
            { id: 'c2', name: '이점원', active: true }
          ]
        }
        return list.filter((c) => c && c.active !== false)
      } catch (e) {
        return [{ id: 'c1', name: '김판매', active: true }]
      }
    },
    storedPin() {
      try {
        const pin = localStorage.getItem(branchKey(this.branchName, 'ktk_wms_branch_pin'))
        return pin && /^\d{4}$/.test(pin) ? pin : DEFAULT_PIN
      } catch (e) {
        return DEFAULT_PIN
      }
    }
  },
  actions: {
    /** 로그인/세션 복구 후: 지점은 점원 모드로 시작 */
    initForUser() {
      const auth = useAuthStore()
      if (!auth.user || auth.isAdmin) {
        this.mode = 'manager'
        this.selectedClerkName = ''
        return
      }
      this.mode = 'clerk'
      const clerks = this.activeClerks
      if (!this.selectedClerkName && clerks.length > 0) {
        this.selectedClerkName = clerks[0].name
      }
      this.pinModalOpen = false
      this.pinInput = ''
      this.pinError = ''
    },
    openPinModal() {
      this.pinInput = ''
      this.pinError = ''
      this.pinModalOpen = true
    },
    closePinModal() {
      this.pinModalOpen = false
      this.pinInput = ''
      this.pinError = ''
    },
    unlockWithPin(rawPin) {
      const pin = String(rawPin ?? this.pinInput ?? '').trim()
      if (!/^\d{4}$/.test(pin)) {
        this.pinError = 'PIN은 4자리 숫자입니다.'
        return false
      }
      if (pin !== this.storedPin) {
        this.pinError = 'PIN이 올바르지 않습니다.'
        return false
      }
      this.mode = 'manager'
      this.selectedClerkName = ''
      this.closePinModal()
      return true
    },
    lockToClerk(clerkName) {
      this.mode = 'clerk'
      const clerks = this.activeClerks
      if (clerkName) {
        this.selectedClerkName = clerkName
      } else if (!this.selectedClerkName && clerks.length > 0) {
        this.selectedClerkName = clerks[0].name
      }
      this.closePinModal()
    },
    setSelectedClerk(name) {
      this.selectedClerkName = name || ''
    },
    reset() {
      this.mode = 'clerk'
      this.selectedClerkName = ''
      this.closePinModal()
    }
  }
})
