<template>
  <div class="login-container">
    <div class="login-card">
      <div class="brand-logo">
        <div class="logo-wrapper">
          <img src="../assets/lady_polo_logo.webp" alt="LADY POLO" class="main-logo" />
        </div>
        <p class="subtitle">작업자 로그인</p>
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label>아이디 (member_name)</label>
          <input v-model="username" type="text" required placeholder="작업자 ID" autofocus />
        </div>

        <div class="input-group">
          <label>비밀번호</label>
          <div class="password-wrapper">
            <input 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              required 
              placeholder="비밀번호" 
            />
            <button type="button" class="btn-eye" @click="togglePassword" tabindex="-1">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="options-group">
          <label class="remember-me">
            <input type="checkbox" v-model="rememberMe" />
            <span>로그인 유지</span>
          </label>
        </div>

        <button type="submit" class="btn-login" :disabled="isLoading">
          {{ isLoading ? 'Authenticating...' : 'Iniciar sesión / 로그인' }}
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
/* 전체 화면 배경은 전역(style.css) 변수를 따름 */
.login-container { 
  display: grid; 
  place-items: center; 
  min-height: 100vh; 
  font-family: var(--sans);
  background: var(--theme-bg-gradient);
  /* 기존에 적용하려던 빛방울 효과는 그라데이션과 겹칠 수 있으므로 심플하게 다크 그라데이션으로 통일합니다 */
}

/* 🌟 글래스모피즘 폼 카드 */
.login-card { 
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--neon-glow), var(--glass-shadow);
  padding: 40px 35px; 
  border-radius: 16px; 
  width: 100%; 
  max-width: 380px; 
  color: var(--text-primary);
}

.brand-logo { text-align: center; margin-bottom: 30px; }

/* 🌟 로고 흰색 배경 제거 마법 (흑백 반전 후 스크린 모드) */
.logo-wrapper {
  background: transparent;
  display: inline-block;
  margin-bottom: 12px;
}
.main-logo { 
  max-width: 160px; 
  height: auto; 
  display: block;
  /* 마법의 CSS: 흑백전환 -> 반전(흰배경은 검게, 로고는 희게) -> 밝기증폭 */
  filter: grayscale(1) invert(1) brightness(1.5) contrast(1.2);
  /* 검은색이 된 기존 배경을 투명하게 만듦 */
  mix-blend-mode: screen;
}

.brand-logo .subtitle { 
  margin: 0; 
  color: var(--text-secondary); 
  font-size: 15px; 
  font-weight: 500; 
}

.login-form { display: flex; flex-direction: column; gap: 20px; }
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-group label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }

/* 🌟 글래스모피즘 인풋 */
.input-group > input, .password-wrapper input { 
  width: 100%; 
  padding: 12px 14px; 
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2); 
  border-radius: 8px; 
  font-size: 14px; 
  color: var(--text-primary);
  outline: none; 
  box-sizing: border-box; 
  transition: all 0.3s ease;
}
.password-wrapper input { padding-right: 45px; }

.input-group > input:focus, .password-wrapper input:focus { 
  border-color: var(--neon-teal);
  background: rgba(0, 255, 204, 0.05);
  box-shadow: 0 0 10px rgba(0, 255, 204, 0.2);
}

/* Placeholder 색상 */
::placeholder { color: rgba(255, 255, 255, 0.3); }

.password-wrapper { position: relative; display: flex; align-items: center; }
.btn-eye { 
  position: absolute; 
  right: 12px; 
  background: none; 
  border: none; 
  font-size: 16px; 
  cursor: pointer; 
  color: var(--text-secondary); 
  padding: 0; 
}
.btn-eye:hover { filter: brightness(1.5); }

.options-group { margin-top: -5px; }
.remember-me { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
.remember-me span { font-size: 13px; color: var(--text-secondary); }
.remember-me input { 
  width: 16px; 
  height: 16px; 
  accent-color: var(--neon-teal); 
  cursor: pointer; 
}

/* 🌟 네온 버튼 */
.btn-login { 
  background: var(--accent-green); 
  color: white; 
  border: none; 
  padding: 14px; 
  border-radius: 8px; 
  font-size: 15px; 
  font-weight: bold; 
  cursor: pointer; 
  transition: all 0.3s ease; 
  margin-top: 10px;
  box-shadow: 0 4px 15px rgba(52, 211, 153, 0.4);
}
.btn-login:hover:not(:disabled) { 
  background: var(--accent-green-hover); 
  box-shadow: 0 4px 20px rgba(52, 211, 153, 0.6);
  transform: translateY(-1px);
}
.btn-login:disabled { background: var(--text-secondary); cursor: not-allowed; box-shadow: none; opacity: 0.7; }
</style>