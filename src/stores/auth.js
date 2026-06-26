import { defineStore } from 'pinia'
import frappeApi from '../api/frappe.js' 

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isLoading: false,
    errorMessage: ''
  }),
  actions: {
    async login(memberName, password) {
      this.isLoading = true
      this.errorMessage = ''
      
      try {
        const response = await frappeApi.post('/api/method/login', {
          usr: memberName,
          pwd: password
        })

        if (response.data.message === 'Logged In') {
          this.user = { id: memberName } 
          return { success: true }
        } else {
          this.errorMessage = '로그인 응답을 확인할 수 없습니다.'
          return { success: false }
        }
      } catch (error) {
        console.error('Frappe Login Error:', error)
        this.errorMessage = '로그인 실패: 아이디와 비밀번호를 다시 확인해주세요.'
        return { success: false }
      } finally {
        this.isLoading = false
      }
    }
  }
})