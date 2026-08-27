import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const geminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''

  return {
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
      }),
      {
        name: 'gemini-dev-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && req.url.startsWith('/api/ai/gemini')) {
              if (!geminiKey) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not set in .env.local' }))
                return
              }
              const chunks = []
              req.on('data', chunk => chunks.push(chunk))
              req.on('end', async () => {
                try {
                  const rawBody = Buffer.concat(chunks).toString()
                  const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${geminiKey}`,
                    {
                      method: req.method,
                      headers: { 'Content-Type': 'application/json' },
                      body: rawBody
                    }
                  )
                  const data = await response.text()
                  res.statusCode = response.status
                  res.setHeader('Content-Type', 'application/json')
                  res.end(data)
                } catch (e) {
                  res.statusCode = 502
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: e.message }))
                }
              })
              return
            }
            next()
          })
        }
      }
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
  }
})