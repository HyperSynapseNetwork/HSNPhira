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
const isSSR = !isBrowser

let appConfig: AppConfig | null = null
let preferencesConfig: PreferencesConfig | null = null
let globalConfig: GlobalConfig | null = null
let downloadConfig: DownloadConfig | null = null
let navigationConfig: NavigationConfig | null = null
let announcementConfig: AnnouncementConfig | null = null
let aboutConfig: AboutConfig | null = null
let docConfig: DocConfig | null = null

// SSR环境配置文件加载辅助函数
async function loadConfigFileSSR<T>(configName: string, defaultValue: T): Promise<T> {
  try {
    const fs = await import('fs')
    const path = await import('path')
    // 尝试多种可能的路径
    const possiblePaths = [
      path.join(process.cwd(), 'public/config', `${configName}.json`),
      path.join(process.cwd(), 'dist/public/config', `${configName}.json`),
      path.join(process.cwd(), 'config', `${configName}.json`),
    ]
    
    for (const configPath of possiblePaths) {
      try {
        if (fs.existsSync(configPath)) {
          const data = fs.readFileSync(configPath, 'utf-8')
          return JSON.parse(data)
        }
      } catch (error) {
        continue
      }
    }
    
    console.warn(`Failed to load ${configName} in SSR, using default`)
    return defaultValue
  } catch (error) {
    console.warn(`Failed to load ${configName} in SSR:`, error)
    return defaultValue
  }
}

// 主配置加载
export async function loadAppConfig(): Promise<AppConfig> {
  if (appConfig) return appConfig

  if (isSSR) {
    const defaultAppConfig = {
      apiMode: 'remote',
      remoteBaseURL: '',
      localBaseURL: '',
      routes: {},
      externalAPI: { phiraBaseURL: '' },
      header: { visiblePages: [] },
      background: { defaultImageURL: '' },
      particleEffects: { snow: '', rain: '' },
      versionFileURL: '',
      meta: {}
    } as AppConfig
    appConfig = await loadConfigFileSSR<AppConfig>('app.config', defaultAppConfig)
    return appConfig!
  }

  const response = await fetch('/config/app.config.json')
  appConfig = await response.json()
  return appConfig!
}

export async function loadPreferencesConfig(): Promise<PreferencesConfig> {
  if (preferencesConfig) return preferencesConfig

  if (isSSR) {
    const defaultPreferencesConfig = {
      version: '1.0.0',
      appId: 'hsnphira-frontend',
      groups: [],
      preferences: []
    } as PreferencesConfig
    preferencesConfig = await loadConfigFileSSR<PreferencesConfig>('preferences.config', defaultPreferencesConfig)
    return preferencesConfig!
  }

  const response = await fetch('/config/preferences.config.json')
  preferencesConfig = await response.json()
  return preferencesConfig!
}

// 新配置加载函数
export async function loadGlobalConfig(): Promise<GlobalConfig> {
  if (globalConfig) return globalConfig

  if (isSSR) {
    const defaultGlobalConfig = {
      serverAddress: '',
      qqGroup: '',
      contactEmail: ''
    } as any as GlobalConfig
    globalConfig = await loadConfigFileSSR<GlobalConfig>('global.config', defaultGlobalConfig)
    return globalConfig!
  }

  const response = await fetch('/config/global.config.json')
  globalConfig = await response.json()
  return globalConfig!
}

export async function loadDownloadConfig(): Promise<DownloadConfig> {
  if (downloadConfig) return downloadConfig

  if (isSSR) {
    const defaultDownloadConfig = {
      latestVersion: '',
      cards: []
    } as any as DownloadConfig
    downloadConfig = await loadConfigFileSSR<DownloadConfig>('download.config', defaultDownloadConfig)
    return downloadConfig!
  }

  const response = await fetch('/config/download.config.json')
  downloadConfig = await response.json()
  return downloadConfig!
}

export async function loadNavigationConfig(): Promise<NavigationConfig> {
  if (navigationConfig) return navigationConfig

  if (isSSR) {
    const defaultNavigationConfig = {
      groups: [],
      cards: []
    } as any as NavigationConfig
    navigationConfig = await loadConfigFileSSR<NavigationConfig>('navigation.config', defaultNavigationConfig)
    return navigationConfig!
  }

  const response = await fetch('/config/navigation.config.json')
  navigationConfig = await response.json()
  return navigationConfig!
}

export async function loadAnnouncementConfig(): Promise<AnnouncementConfig> {
  if (announcementConfig) return announcementConfig

  if (isSSR) {
    const defaultAnnouncementConfig = {
      announcements: []
    } as any as AnnouncementConfig
    announcementConfig = await loadConfigFileSSR<AnnouncementConfig>('announcement.config', defaultAnnouncementConfig)
    return announcementConfig!
  }

  const response = await fetch('/config/announcement.config.json')
  announcementConfig = await response.json()
  return announcementConfig!
}

export async function loadAboutConfig(): Promise<AboutConfig> {
  if (aboutConfig) return aboutConfig

  if (isSSR) {
    const defaultAboutConfig = {
      teamDescription: {},
      teamMembers: [],
      acknowledgments: []
    } as any as AboutConfig
    aboutConfig = await loadConfigFileSSR<AboutConfig>('about.config', defaultAboutConfig)
    return aboutConfig!
  }

  const response = await fetch('/config/about.config.json')
  aboutConfig = await response.json()
  return aboutConfig!
}

export async function loadDocConfig(): Promise<DocConfig> {
  if (docConfig) return docConfig

  if (isSSR) {
    const defaultDocConfig = {
      cards: [],
      pages: {},
      categories: {}
    } as any as DocConfig
    docConfig = await loadConfigFileSSR<DocConfig>('docs.config', defaultDocConfig)
    return docConfig!
  }

  const response = await fetch('/config/docs.config.json')
  docConfig = await response.json()
  return docConfig!
}

// 获取配置函数
export function getAppConfig(): AppConfig {
  if (!appConfig) {
    console.warn('App config not loaded, returning empty config')
    return {
      apiMode: 'remote',
      remoteBaseURL: '',
      localBaseURL: '',
      routes: {},
      externalAPI: { phiraBaseURL: '' },
      header: { visiblePages: [] },
      background: { defaultImageURL: '' },
      particleEffects: { snow: '', rain: '' },
      versionFileURL: '',
      meta: {}
    } as AppConfig
  }
  return appConfig as AppConfig
}

export function getPreferencesConfig(): PreferencesConfig {
  if (!preferencesConfig) {
    console.warn('Preferences config not loaded, returning empty config')
    return { 
      version: '1.0.0',
      appId: 'hsnphira-frontend',
      groups: [],
      preferences: [] 
    } as PreferencesConfig
  }
  return preferencesConfig as PreferencesConfig
}

export function getGlobalConfig(): GlobalConfig {
  if (!globalConfig) {
    console.warn('Global config not loaded, returning empty config')
    return { serverAddress: '', qqGroup: '', contactEmail: '' } as any as GlobalConfig
  }
  return globalConfig as GlobalConfig
}

export function getDownloadConfig(): DownloadConfig {
  if (!downloadConfig) {
    console.warn('Download config not loaded, returning empty config')
    return { latestVersion: '', cards: [] } as any as DownloadConfig
  }
  return downloadConfig as DownloadConfig
}

export function getNavigationConfig(): NavigationConfig {
  if (!navigationConfig) {
    console.warn('Navigation config not loaded, returning empty config')
    return { groups: [], cards: [] } as any as NavigationConfig
  }
  return navigationConfig as NavigationConfig
}

export function getAnnouncementConfig(): AnnouncementConfig {
  if (!announcementConfig) {
    console.warn('Announcement config not loaded, returning empty config')
    return { announcements: [] } as any as AnnouncementConfig
  }
  return announcementConfig as AnnouncementConfig
}

export function getAboutConfig(): AboutConfig {
  if (!aboutConfig) {
    console.warn('About config not loaded, returning empty config')
    return { teamDescription: {}, teamMembers: [], acknowledgments: [] } as any as AboutConfig
  }
  return aboutConfig as AboutConfig
}

export function getDocConfig(): DocConfig {
  if (!docConfig) {
    console.warn('Doc config not loaded, returning empty config')
    return { cards: [], pages: {}, categories: {} } as any as DocConfig
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
