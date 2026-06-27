<template>
  <div class="login-container">
    <div class="login-card">
      <div class="brand-logo">
        <img src="../assets/lady_polo_logo.webp" alt="LADY POLO" class="main-logo" />
        <p>WMS Operator Login</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label>User ID</label>
          <input v-model="username" type="text" required placeholder="Frappe Email or ID" autofocus />
        </div>

        <div class="input-group">
          <label>Password</label>
          <div class="password-wrapper">
            <input 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              required 
              placeholder="Enter Password" 
            />
            <button type="button" class="btn-eye" @click="togglePassword" tabindex="-1">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="options-group">
          <label class="remember-me">
            <input type="checkbox" v-model="rememberMe" />
            <span>Remember Me</span>
          </label>
        </div>

        <button type="submit" class="btn-login" :disabled="isLoading">
          {{ isLoading ? 'Authenticating...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import axios from 'axios'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const isLoading = ref(false)

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true 
})

onMounted(() => {
  const savedUsr = localStorage.getItem('lady_polo_usr')
  const savedPwd = localStorage.getItem('lady_polo_pwd')
  if (savedUsr && savedPwd) {
    username.value = savedUsr
    password.value = savedPwd
    rememberMe.value = true
  }
})

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const handleLogin = async () => {
  if (isLoading.value) return
  isLoading.value = true

  try {
    const response = await frappeApi.post('/api/method/login', {
      usr: username.value,
      pwd: password.value
    })

    if (response.status === 200) {
      if (rememberMe.value) {
        localStorage.setItem('lady_polo_usr', username.value)
        localStorage.setItem('lady_polo_pwd', password.value)
      } else {
        localStorage.removeItem('lady_polo_usr')
        localStorage.removeItem('lady_polo_pwd')
      }

      authStore.user = { 
        member_name: username.value, 
        access_level: 'Admin',
        branch_name: 'Centro'
      }
      
      router.push('/pos')
    }
  } catch (error) {
    console.error('Login Error:', error)
    alert('Login failed: Please check your ID and Password, or Frappe server status.')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container { display: grid; place-items: center; min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); font-family: sans-serif; }
.login-card { background: white; padding: 40px; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
.brand-logo { text-align: center; margin-bottom: 30px; }

/* 🌟 새로 추가된 로고 이미지 스타일 */
.main-logo { max-width: 220px; height: auto; margin-bottom: 8px; display: block; margin-left: auto; margin-right: auto; }

.brand-logo p { margin: 5px 0 0; color: #64748b; font-size: 14px; font-weight: 500; }
.login-form { display: flex; flex-direction: column; gap: 20px; }
.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-group label { font-size: 12px; font-weight: bold; color: #475569; }

.password-wrapper { position: relative; display: flex; align-items: center; }
.password-wrapper input { width: 100%; padding: 12px; padding-right: 45px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; box-sizing: border-box; }
.password-wrapper input:focus { border-color: #00a896; }

.btn-eye { position: absolute; right: 10px; background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; padding: 0; display: flex; align-items: center; justify-content: center; }
.btn-eye:hover { opacity: 0.7; }

.input-group > input { padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; box-sizing: border-box; }
.input-group > input:focus { border-color: #00a896; }

.options-group { margin-top: -5px; }
.remember-me { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.remember-me span { font-size: 13px; color: #475569; }
.remember-me input { width: 15px; height: 15px; accent-color: #00a896; cursor: pointer; }

.btn-login { background: #00a896; color: white; border: none; padding: 14px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s; margin-top: 10px; }
.btn-login:hover { background: #008f80; }
.btn-login:disabled { background: #94a3b8; cursor: not-allowed; }
</style>