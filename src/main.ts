import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import { loadAppConfig, loadPreferencesConfig, initializeUserPreferences } from './utils/config'
import { initTheme } from './utils/theme'
import { useI18nStore } from './stores/i18n'

// 异步初始化应用
async function initApp() {
  // 先加载配置
  await loadAppConfig()
  await loadPreferencesConfig()
  initializeUserPreferences()
  
  // 初始化主题
  initTheme()

  // 创建应用
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)

  // 初始化国际化
  const i18nStore = useI18nStore()
  i18nStore.initLanguage()

  app.mount('#app')
}

// 启动应用
initApp().catch(error => {
  console.error('Failed to initialize app:', error)
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
      <div style="text-align: center;">
        <h1 style="color: #ef4444;">应用初始化失败</h1>
        <p style="color: #6b7280;">请检查配置文件是否存在</p>
        <pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">${error.message}</pre>
      </div>
    </div>
  `
})
