import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}']
      },
      // 개발 중 SW 캐시가 옛 번들을 붙잡으면 index.html만 뜨고 #app이 비는 흰 화면이 된다.
      // 프로덕션 빌드에서만 PWA를 켠다.
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'KTK WMS',
        short_name: 'WMS',
        description: 'KTK Warehouse Management System',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
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
        target: 'https://ktkpos.frappe.cloud',
        changeOrigin: true,
        secure: false
      }
    }
  }
})