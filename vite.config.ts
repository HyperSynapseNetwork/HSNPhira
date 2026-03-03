import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import compression from 'vite-plugin-compression'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      VitePWA({
        // 使用 injectManifest 策略：VitePWA 只注入预缓存清单，
        // 完整 SW 逻辑（含 push 事件处理）保留在 public/sw.js
        // 这样 Workbox 不会覆盖我们的自定义 SW，推送通知才能正常工作
        strategies: 'injectManifest',
        srcDir: 'public',
        filename: 'sw.js',
        registerType: 'autoUpdate',
        manifest: false,
        includeAssets: ['favicon.png', 'logo.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
        injectManifest: {
          // 预缓存这些文件类型（Vite 构建产物）
          globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,svg,gif,ico,woff,woff2,ttf,eot}'],
          // 排除 HSNPM 相关文件
          globIgnores: ['**/workbox-*.js', '**/sw.js']
        },
        devOptions: { enabled: false }
      }),
      // Gzip 压缩
      compression({
        algorithm: 'gzip',
        ext: '.gz',
        threshold: 1024, // 大于 1KB 的文件才压缩
        deleteOriginFile: false,
      }),
      // Brotli 压缩
      compression({
        algorithm: 'brotliCompress',
        ext: '.br',
        threshold: 1024,
        deleteOriginFile: false,
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
        // SSE 房间通知代理到远程服务器（前端可能不再直接使用，但保留）
        '/api/rooms/listen': {
          target: 'https://phira.htadiy.com',
          changeOrigin: true,
          secure: false, // 如果目标服务器使用自签名证书，可能需要设置为 false
          ws: false, // SSE 不是 WebSocket，但保持为 false
          rewrite: (path) => path // 保持路径不变
        },
        // HSNPM 通知服务代理（开发环境） - 代理到远程HSNPM服务
        '/hsnpm-api': {
          target: 'https://phira.htadiy.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/hsnpm-api/, '') // 去掉 /hsnpm-api 前缀，前端请求 /hsnpm-api/subscriptions -> https://phira.htadiy.com/subscriptions
        }
      } : undefined,
    },
  }
})
