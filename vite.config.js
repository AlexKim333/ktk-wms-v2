import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      // 🌟 로컬에서 /api로 시작하는 모든 요청을 프라페 클라우드로 안전하게 토스합니다.
      '/api': {
        target: 'https://ktkinventario.v.frappe.cloud',
        changeOrigin: true,
        secure: false
      }
    }
  }
})