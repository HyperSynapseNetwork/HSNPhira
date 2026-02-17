import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import { routes } from './router'
import './styles/main.css'
import { loadAppConfig, loadPreferencesConfig, initializeUserPreferences } from './utils/config'
import { useI18nStore } from './stores/i18n'

export const createApp = ViteSSG(
  App,
  { routes, base: import.meta.env.BASE_URL },
  async ({ app, router, isClient }) => {
    const pinia = createPinia()
    app.use(pinia)

    if (isClient) {
      await loadAppConfig()
      await loadPreferencesConfig()
      initializeUserPreferences()

      const i18nStore = useI18nStore()
      i18nStore.initLanguage()
    }

    router.beforeEach((to, _from, next) => {
      if (isClient) {
        import('@/utils/meta').then(({ updatePageMeta, getPageNameFromRoute }) => {
          updatePageMeta(getPageNameFromRoute(to.path))
        })

        if (to.meta?.title) document.title = to.meta.title as string

        if (to.meta?.description) {
          let el = document.querySelector('meta[name="description"]')
          if (!el) { el = document.createElement('meta'); el.setAttribute('name', 'description'); document.head.appendChild(el) }
          el.setAttribute('content', to.meta.description as string)
        }

        if (to.meta?.keywords) {
          let el = document.querySelector('meta[name="keywords"]')
          if (!el) { el = document.createElement('meta'); el.setAttribute('name', 'keywords'); document.head.appendChild(el) }
          el.setAttribute('content', to.meta.keywords as string)
        }
      }
      next()
    })
  },
)
