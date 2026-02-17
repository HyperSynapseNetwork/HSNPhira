import { getAppConfig } from './config'
import { detectLanguage, type Language } from '@/i18n'

// SSR 环境判断
const isBrowser = typeof window !== 'undefined'

export interface PageMeta {
  title: string
  description: string
}

export interface PageMetaConfig {
  title: Record<string, string> // {zh: ..., en: ..., ja: ...}
  description: Record<string, string>
}

/**
 * 获取页面meta配置
 * @param pageName 页面名称（对应app.config.json中的meta键名）
 * @returns 页面meta配置或null
 */
export function getPageMetaConfig(pageName: string): PageMetaConfig | null {
  try {
    const config = getAppConfig()
    const meta = config.meta?.[pageName]
    if (!meta) return null

    // 确保格式正确
    const title = typeof meta.title === 'string'
      ? { zh: meta.title, en: meta.title, ja: meta.title }
      : meta.title || { zh: '', en: '', ja: '' }

    const description = typeof meta.description === 'string'
      ? { zh: meta.description, en: meta.description, ja: meta.description }
      : meta.description || { zh: '', en: '', ja: '' }

    return { title, description }
  } catch (error) {
    console.error(`Failed to get page meta config for ${pageName}:`, error)
    return null
  }
}

/**
 * 获取当前语言（从localStorage或浏览器检测，SSR 时返回默认语言）
 */
function getCurrentLanguage(): Language {
  if (!isBrowser) return 'zh'
  const saved = localStorage.getItem('hsn_language') as Language
  if (saved && ['zh', 'en', 'ja'].includes(saved)) {
    return saved
  }
  return detectLanguage()
}

/**
 * 获取页面meta信息（根据当前语言）
 * @param pageName 页面名称
 * @param language 语言代码（zh/en/ja），默认使用当前语言
 * @returns 页面meta信息
 */
export function getPageMeta(pageName: string, language?: string): PageMeta {
  const config = getPageMetaConfig(pageName)
  const lang = language || getCurrentLanguage()

  if (!config) {
    return {
      title: pageName,
      description: ''
    }
  }

  // 获取对应语言的标题和描述，如果不存在则使用zh
  const title = config.title[lang] || config.title.zh || pageName
  const description = config.description[lang] || config.description.zh || ''

  return { title, description }
}

/**
 * 更新页面标题和meta标签（仅浏览器端可用）
 * @param pageName 页面名称
 */
export function updatePageMeta(pageName: string): void {
  if (!isBrowser) return

  const meta = getPageMeta(pageName)

  // 更新文档标题
  document.title = meta.title

  // 更新meta标签
  const descriptionMeta = document.querySelector('meta[name="description"]')
  if (descriptionMeta) {
    descriptionMeta.setAttribute('content', meta.description)
  } else {
    const metaTag = document.createElement('meta')
    metaTag.name = 'description'
    metaTag.content = meta.description
    document.head.appendChild(metaTag)
  }

  // 更新og:title和og:description（用于社交媒体）
  const ogTitle = document.querySelector('meta[property="og:title"]')
  const ogDescription = document.querySelector('meta[property="og:description"]')

  if (ogTitle) ogTitle.setAttribute('content', meta.title)
  if (ogDescription) ogDescription.setAttribute('content', meta.description)
}

/**
 * 根据路由路径获取页面名称
 * @param routePath 路由路径
 * @returns 页面名称
 */
export function getPageNameFromRoute(routePath: string): string {
  const path = routePath.replace(/^\/|\/$/g, '')

  // 映射路由路径到页面名称
  const routeMap: Record<string, string> = {
    '': 'home',
    'rooms': 'rooms',
    'chart-ranking': 'chart-ranking',
    'user-ranking': 'user-ranking',
    'chart-download': 'chart-download',
    'phira-download': 'phira-download',
    'navigation': 'navigation',
    'announcement': 'announcement',
    'agreement': 'agreement'
  }

  return routeMap[path] || 'home'
}
