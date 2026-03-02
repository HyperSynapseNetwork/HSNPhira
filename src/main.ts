import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import { routes } from './router'
import './styles/main.css'
import { loadAllConfigs, initializeUserPreferences } from './utils/config'
import { useI18nStore } from './stores/i18n'
import './utils/notification' // 导入以初始化通知服务

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
  async ({ app, router, isClient }) => {
    const pinia = createPinia()
    app.use(pinia)

    // 在SSR和客户端都加载配置
    try {
      await loadAllConfigs()
    } catch (error) {
      console.warn('Failed to load configs in SSR:', error)
      // 在SSR中继续，配置可能在客户端重新加载
    }
    
    if (isClient) {
      initializeUserPreferences()

      const i18nStore = useI18nStore()
      i18nStore.initLanguage()

      // 初始路由的 meta 更新
      router.isReady().then(async () => {
        const { updatePageMeta, getPageNameFromRoute } = await import('@/utils/meta')
        await updatePageMeta(getPageNameFromRoute(router.currentRoute.value.path))
      })
    }

    router.beforeEach(async (to, _from, next) => {
      if (isClient) {
        const { updatePageMeta, getPageNameFromRoute } = await import('@/utils/meta')
        await updatePageMeta(getPageNameFromRoute(to.path))

        // Title and description are now handled by meta.ts
        // if (to.meta?.title) document.title = to.meta.title as string
        // if (to.meta?.description) {
        //   let el = document.querySelector('meta[name="description"]')
        //   if (!el) { el = document.createElement('meta'); el.setAttribute('name', 'description'); document.head.appendChild(el) }
        //   el.setAttribute('content', to.meta.description as string)
        // }

        // Keywords are now handled by meta.ts
        // if (to.meta?.keywords) {
        //   let el = document.querySelector('meta[name="keywords"]')
        //   if (!el) { el = document.createElement('meta'); el.setAttribute('name', 'keywords'); document.head.appendChild(el) }
        //   el.setAttribute('content', to.meta.keywords as string)
        // }

        // 检查路由是否需要认证
        if (to.meta?.requiresAuth) {
          // 动态导入userStore，避免SSG问题
          const { useUserStore } = await import('@/store')
          const userStore = useUserStore()
          
          // 如果用户信息未加载，尝试获取
          if (!userStore.user && !userStore.isLoggedIn) {
            const success = await userStore.fetchUser()
            if (!success) {
              // 未登录，重定向到首页并打开登录窗口
              const { eventBus } = await import('@/utils/eventBus')
              eventBus.emit('open-window', 'auth')
              next('/')
              return
            }
          }
        }
      }
      next()
    })
  },
)
