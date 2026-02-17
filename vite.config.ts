import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    // SSG 配置（vite-ssg）
    // 仅在执行 build:ssg 时生效，普通 build 忽略此项
    ssgOptions: {
      script: 'async',
      formatting: 'minify',
      // 只预渲染不含动态参数的静态路由
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
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:8080',
          changeOrigin: true,
          // rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/rankapi': {
          target: env.VITE_API_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
        '/chart': {
          target: env.VITE_API_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
        '/topchart/hot_rank': {
          target: env.VITE_API_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
        '/chart_rank': {
          target: env.VITE_API_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
        '/user_rank': {
          target: env.VITE_API_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      } : undefined,
    },
  }
})
