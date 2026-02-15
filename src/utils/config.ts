import type { AppConfig, PreferencesConfig } from '@/types'

let appConfig: AppConfig | null = null
let preferencesConfig: PreferencesConfig | null = null

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

// 用户偏好管理
const STORAGE_KEY = 'hsn_user_preferences'

export function getUserPreferences(): Record<string, any> {
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
  const config = getPreferencesConfig()
  const defaults: Record<string, any> = {}
  
  config.preferences.forEach(pref => {
    defaults[pref.id] = pref.default
  })
  
  saveUserPreferences(defaults)
}

// 初始化用户偏好
export function initializeUserPreferences(): void {
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
