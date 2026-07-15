<template>
  <div class="login-container">
    <div class="lang-switcher-wrapper">
      <LanguageSwitcher />
    </div>
    <div class="login-card">
      <div class="brand-logo">
        <div class="logo-wrapper">
          <img src="../assets/lady_polo_logo.webp" alt="LADY POLO" class="main-logo" />
        </div>
        <p class="subtitle">{{ $t('login.subtitle') }}</p>
      </div>

      <form v-if="loginMode === 'password'" @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <label>{{ $t('login.id_label') }}</label>
          <input v-model="username" type="text" required :placeholder="$t('login.id_placeholder')" autofocus />
        </div>

        <div class="input-group">
          <label>{{ $t('login.pwd_label') }}</label>
          <div class="password-wrapper">
            <input 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              required 
              :placeholder="$t('login.pwd_placeholder')" 
            />
            <button type="button" class="btn-eye" @click="togglePassword" tabindex="-1">
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="options-group">
          <label class="remember-me">
            <input type="checkbox" v-model="rememberMe" />
            <span>{{ $t('login.remember_me') }}</span>
          </label>
        </div>

        <button type="submit" class="btn-login" :disabled="isLoading">
          {{ isLoading ? $t('login.authenticating') : $t('login.login_btn') }}
        </button>

        <button type="button" class="btn-secondary" @click="loginMode = 'email'">
          이메일로 인증하여 로그인
        </button>
      </form>

      <!-- 이메일 인증 폼 -->
      <form v-else @submit.prevent="handleEmailLogin" class="login-form">
        <div class="input-group">
          <label>이메일 주소</label>
          <input v-model="email" type="email" required placeholder="example@ktk.com" autofocus :disabled="otpSent" />
        </div>

        <div v-if="otpSent" class="input-group">
          <label>인증 번호</label>
          <input v-model="otpCode" type="text" required placeholder="인증 번호 6자리 입력" />
        </div>

        <button v-if="!otpSent" type="button" class="btn-login" :disabled="isLoading" @click="sendOtp">
          {{ isLoading ? '발송 중...' : '인증 번호 받기' }}
        </button>
        <button v-else type="submit" class="btn-login" :disabled="isLoading">
          {{ isLoading ? '인증 중...' : '인증 및 로그인' }}
        </button>

        <button type="button" class="btn-secondary" @click="loginMode = 'password'">
          아이디/비밀번호로 로그인
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
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const rememberMe = ref(false)
const showPassword = ref(false)
const isLoading = ref(false)

// 이메일 로그인 관련 상태
const loginMode = ref('password') // 'password' or 'email'
const email = ref('')
const otpCode = ref('')
const otpSent = ref(false)

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
        // Fetch user data (roles and permissions)
        let roles = [];
        let branch = null;
        let accessLevel = 'Representative'; // default

        try {
          const userRes = await frappeApi.get(`/api/resource/User/${username.value}`);
          if (userRes.data && userRes.data.data) {
            const userData = userRes.data.data;
            roles = userData.roles ? userData.roles.map(r => r.role) : [];
            
            if (roles.includes('System Manager')) {
              accessLevel = 'Admin';
            } else if (roles.includes('Branch Manager')) {
              accessLevel = 'Manager';
            }
          }
          
          // Fetch User Permission for Warehouse
          const permRes = await frappeApi.get('/api/resource/User Permission', {
            params: {
              filters: JSON.stringify([['user', '=', username.value], ['allow', '=', 'Warehouse']]),
              fields: JSON.stringify(['for_value']),
              limit_page_length: 1
            }
          });
          
          if (permRes.data && permRes.data.data && permRes.data.data.length > 0) {
            branch = permRes.data.data[0].for_value;
          }
        } catch (e) {
          console.error('Failed to fetch user permissions', e);
        }

        // Fallback for Admin
        if (accessLevel === 'Admin' && !branch) {
          branch = 'TIENDA - K'; // Default branch for admin if no permission is set
        }

        authStore.user = { 
          member_name: username.value, 
          access_level: accessLevel,
          branch_name: branch,
          roles: roles
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

// 이메일 OTP 발송 요청 (향후 Frappe API 연동)
const sendOtp = async () => {
  if (!email.value) return alert('이메일을 입력해 주세요.')
  isLoading.value = true
  try {
    // TODO: 백엔드 이메일 인증 발송 API 호출
    // await frappeApi.post('/api/method/send_login_otp', { email: email.value })
    
    // 시뮬레이션 성공 처리
    setTimeout(() => {
      otpSent.value = true
      isLoading.value = false
      alert('인증 번호가 발송되었습니다. (테스트 환경이므로 아무 번호나 입력하세요)')
    }, 1000)
  } catch (error) {
    console.error('OTP Send Error:', error)
    alert('인증 번호 발송에 실패했습니다.')
    isLoading.value = false
  }
}

// 이메일 OTP 로그인 처리
const handleEmailLogin = async () => {
  if (!otpCode.value) return alert('인증 번호를 입력해 주세요.')
  isLoading.value = true
  try {
    // TODO: 백엔드 이메일 인증 로그인 API 호출
    // const response = await frappeApi.post('/api/method/login_with_otp', { email: email.value, otp: otpCode.value })

    // 시뮬레이션 성공 처리
    setTimeout(() => {
      authStore.user = { 
        member_name: email.value, 
        access_level: 'Admin',
        branch_name: 'Centro'
      }
      router.push('/pos')
    }, 1000)
  } catch (error) {
    console.error('Email Login Error:', error)
    alert('인증에 실패했습니다.')
    isLoading.value = false
  }
}
</script>

<style scoped>
.lang-switcher-wrapper {
  position: absolute;
  top: 20px;
  right: 20px;
}
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

/* 🌟 보조 버튼 (이메일 인증 전환 등) */
.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: -5px;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.4);
}
</style>
