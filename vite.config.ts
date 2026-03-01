import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: 'autoUpdate',
        // Use public/manifest.json directly (manifest: false)
        manifest: false,
        includeAssets: ['favicon.png', 'logo.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,gif,ico,woff,woff2,ttf,eot}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              urlPattern: /^https:\/\/api\./i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        },
        devOptions: { enabled: false }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // SSG 配置（vite-ssg）- 仅在执行 build:ssg 时生效
    ssgOptions: {
      script: 'async',
      formatting: 'minify',
      includedRoutes(paths: string[]) {
        return paths.filter((p) => !p.includes(':'))
      },
      onFinished() {
        console.log('[SSG] 静态页面生成完成！')
      },
    },

    server: {
      port: 3000,
      proxy: env.VITE_USE_PROXY === 'true' ? {
        '/api': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true },
        '/rankapi': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true },
        '/chart': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true },
        '/topchart/hot_rank': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true },
        '/topchart/chart_rank': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true },
        '/chart_rank': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true },
        '/user_rank': { target: env.VITE_API_TARGET || 'http://localhost:8080', changeOrigin: true },
      } : undefined,
    },
  }
})
