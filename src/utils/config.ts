import type { 
  AppConfig, 
  PreferencesConfig, 
  MultiLanguageText,
  GlobalConfig,
  DownloadConfig,
  NavigationConfig,
  AnnouncementConfig,
  AboutConfig,
  DocConfig
} from '@/types'
import { useI18nStore } from '@/stores/i18n'
import type { Language } from '@/i18n'

// SSR 环境判断工具
const isBrowser = typeof window !== 'undefined'

let appConfig: AppConfig | null = null
let preferencesConfig: PreferencesConfig | null = null
let globalConfig: GlobalConfig | null = null
let downloadConfig: DownloadConfig | null = null
let navigationConfig: NavigationConfig | null = null
let announcementConfig: AnnouncementConfig | null = null
let aboutConfig: AboutConfig | null = null
let docConfig: DocConfig | null = null

// 主配置加载
export async function loadAppConfig(): Promise<AppConfig> {
  if (appConfig) return appConfig

  const response = await fetch('/config/app.config.json')
  appConfig = await response.json()
  return appConfig!
}

export async function loadPreferencesConfig(): Promise<PreferencesConfig> {
  if (preferencesConfig) return preferencesConfig

  const response = await fetch('/config/preferences.config.json')
  preferencesConfig = await response.json()
  return preferencesConfig!
}

// 新配置加载函数
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  if (globalConfig) return globalConfig

  const response = await fetch('/config/global.config.json')
  globalConfig = await response.json()
  return globalConfig!
}

export async function loadDownloadConfig(): Promise<DownloadConfig> {
  if (downloadConfig) return downloadConfig

  const response = await fetch('/config/download.config.json')
  downloadConfig = await response.json()
  return downloadConfig!
}

export async function loadNavigationConfig(): Promise<NavigationConfig> {
  if (navigationConfig) return navigationConfig

  const response = await fetch('/config/navigation.config.json')
  navigationConfig = await response.json()
  return navigationConfig!
}

export async function loadAnnouncementConfig(): Promise<AnnouncementConfig> {
  if (announcementConfig) return announcementConfig

  const response = await fetch('/config/announcement.config.json')
  announcementConfig = await response.json()
  return announcementConfig!
}

export async function loadAboutConfig(): Promise<AboutConfig> {
  if (aboutConfig) return aboutConfig

  const response = await fetch('/config/about.config.json')
  aboutConfig = await response.json()
  return aboutConfig!
}

export async function loadDocConfig(): Promise<DocConfig> {
  if (docConfig) return docConfig

  const response = await fetch('/config/docs.config.json')
  docConfig = await response.json()
  return docConfig!
}

// 获取配置函数
export function getAppConfig(): AppConfig {
  if (!appConfig) {
    throw new Error('App config not loaded')
  }
  return appConfig as AppConfig
}

export function getPreferencesConfig(): PreferencesConfig {
  if (!preferencesConfig) {
    throw new Error('Preferences config not loaded')
  }
  return preferencesConfig as PreferencesConfig
}

export function getGlobalConfig(): GlobalConfig {
  if (!globalConfig) {
    throw new Error('Global config not loaded')
  }
  return globalConfig as GlobalConfig
}

export function getDownloadConfig(): DownloadConfig {
  if (!downloadConfig) {
    throw new Error('Download config not loaded')
  }
  return downloadConfig as DownloadConfig
}

export function getNavigationConfig(): NavigationConfig {
  if (!navigationConfig) {
    throw new Error('Navigation config not loaded')
  }
  return navigationConfig as NavigationConfig
}

export function getAnnouncementConfig(): AnnouncementConfig {
  if (!announcementConfig) {
    throw new Error('Announcement config not loaded')
  }
  return announcementConfig as AnnouncementConfig
}

export function getAboutConfig(): AboutConfig {
  if (!aboutConfig) {
    throw new Error('About config not loaded')
  }
  return aboutConfig as AboutConfig
}

export function getDocConfig(): DocConfig {
  if (!docConfig) {
    throw new Error('Doc config not loaded')
  }
  return docConfig as DocConfig
}

// 多语言文本辅助函数
export function getLocalizedText(text: MultiLanguageText, language?: Language): string {
  if (!text) return ''
  
  const i18nStore = useI18nStore()
  const lang = language || i18nStore.currentLanguage
  
  // 尝试获取当前语言，如果不存在则使用zh作为回退
  return text[lang] || text['zh'] || ''
}

// 批量加载所有配置
export async function loadAllConfigs(): Promise<void> {
  await Promise.all([
    loadAppConfig(),
    loadPreferencesConfig(),
    loadGlobalConfig(),
    loadDownloadConfig(),
    loadNavigationConfig(),
    loadAnnouncementConfig(),
    loadAboutConfig(),
    loadDocConfig()
  ])
}

export function getBaseURL(): string {
  const config = getAppConfig()
  return config.apiMode === 'remote' ? config.remoteBaseURL : config.localBaseURL
}

export function getPhiraBaseURL(): string {
  const config = getAppConfig()
  return config.externalAPI.phiraBaseURL
}

export function getAPIRoute(category: string, name: string, params?: Record<string, string>): string {
  const config = getAppConfig()
  let route = config.routes[category]?.[name]

  if (!route) {
    throw new Error(`API route not found: ${category}.${name}`)
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      route = route.replace(`:${key}`, value)
    })
  }

  return route
}

// 用户偏好管理（依赖 localStorage，SSR 环境不可用，全部加 isBrowser 守卫）
const STORAGE_KEY = 'hsn_user_preferences'

export function getUserPreferences(): Record<string, any> {
  if (!isBrowser) return {}
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return {}
    }
  }
  return {}
}

export function saveUserPreferences(preferences: Record<string, any>): void {
  if (!isBrowser) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))

  // 应用主题色
  if (preferences.theme_color) {
    document.documentElement.style.setProperty('--primary-color', preferences.theme_color)
  }
}

export function getUserPreference(key: string, defaultValue?: any): any {
  const preferences = getUserPreferences()
  return preferences[key] ?? defaultValue
}

export function setUserPreference(key: string, value: any): void {
  const preferences = getUserPreferences()
  preferences[key] = value
  saveUserPreferences(preferences)
}

export function resetUserPreferences(): void {
  if (!isBrowser) return
  const config = getPreferencesConfig()
  const defaults: Record<string, any> = {}

  config.preferences.forEach(pref => {
    defaults[pref.id] = pref.default
  })

  saveUserPreferences(defaults)
}

// 初始化用户偏好（仅客户端）
export function initializeUserPreferences(): void {
  if (!isBrowser) return
  const config = getPreferencesConfig()
  const current = getUserPreferences()

  // 合并默认值
  config.preferences.forEach(pref => {
    if (!(pref.id in current)) {
      current[pref.id] = pref.default
    }
  })

  saveUserPreferences(current)
}
