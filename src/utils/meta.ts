import { getAppConfig } from './config'
import { useI18nStore } from '@/stores/i18n'
import type { Language } from '@/i18n'

const BASE_URL = 'https://phira.htadiy.com'

const LANG_TO_HTML_LANG: Record<Language, string> = {
  'zh': 'zh-CN',
  'zh-TW': 'zh-TW',
  'en': 'en',
  'ja': 'ja',
}

const LANG_TO_OG_LOCALE: Record<Language, string> = {
  'zh': 'zh_CN',
  'zh-TW': 'zh_TW',
  'en': 'en_US',
  'ja': 'ja_JP',
}

export interface SchemaData {
  '@context': string
  '@type': string
  [key: string]: any
}

export interface PageMeta {
  title: Record<Language, string>
  description: Record<Language, string>
  keywords?: Record<Language, string>
}

export async function getPageMeta(routeName: string): Promise<PageMeta | null> {
  const config = getAppConfig()

  if (routeName === 'docs-home' || routeName.startsWith('doc-')) {
    try {
      const { loadDocsConfig, getDocPage } = await import('./docs')
      await loadDocsConfig()
      const pageId = routeName === 'docs-home' ? 'home' : routeName.replace('doc-', '')
      const page = getDocPage(pageId)
      if (page) {
        return {
          title: page.title,
          description: page.description,
          keywords: {
            'zh': '文档,指南,帮助',
            'zh-TW': '文檔,指南,幫助',
            'en': 'documentation,guide,help',
            'ja': 'ドキュメント,ガイド,ヘルプ'
          }
        }
      }
    } catch (error) {
      console.error('Error loading docs meta:', error)
    }
  }

  const meta = config.meta?.[routeName]
  if (!meta) {
    console.warn(`No meta found for route "${routeName}" in config.meta`)
    return null
  }
  return meta as PageMeta
}

function getPathFromRouteName(routeName: string): string {
  if (routeName === 'home') return '/'
  if (routeName === 'docs-home') return '/md'
  if (routeName.startsWith('doc-')) return `/md/${routeName.replace('doc-', '')}`
  return `/${routeName}`
}

function setMetaName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (el) {
    el.setAttribute('content', content)
  } else {
    const meta = document.createElement('meta')
    meta.setAttribute('name', name)
    meta.setAttribute('content', content)
    document.head.appendChild(meta)
  }
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (el) {
    el.setAttribute('content', content)
  } else {
    const meta = document.createElement('meta')
    meta.setAttribute('property', property)
    meta.setAttribute('content', content)
    document.head.appendChild(meta)
  }
}

/** Update <html lang> attribute to match current language */
export function updateHtmlLang(language: Language) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = LANG_TO_HTML_LANG[language] || 'zh-CN'
}

/** Update canonical link element */
export function updateCanonical(routeName: string) {
  if (typeof document === 'undefined') return
  const path = getPathFromRouteName(routeName)
  const canonicalUrl = path === '/' ? BASE_URL : `${BASE_URL}${path}`

  let el = document.getElementById('canonical-link') as HTMLLinkElement | null
  if (el) {
    el.href = canonicalUrl
  } else {
    const link = document.createElement('link')
    link.rel = 'canonical'
    link.id = 'canonical-link'
    link.href = canonicalUrl
    document.head.appendChild(link)
  }
  setMetaProperty('og:url', canonicalUrl)
}

/** Update hreflang alternate links */
export function updateHreflang(routeName: string) {
  if (typeof document === 'undefined') return
  const path = getPathFromRouteName(routeName)
  const pageUrl = path === '/' ? BASE_URL : `${BASE_URL}${path}`

  const hreflangMap: Array<[string, string]> = [
    ['hreflang-zh', 'zh-CN'],
    ['hreflang-zh-TW', 'zh-TW'],
    ['hreflang-en', 'en'],
    ['hreflang-ja', 'ja'],
    ['hreflang-default', 'x-default'],
  ]

  for (const [id, hreflang] of hreflangMap) {
    let el = document.getElementById(id) as HTMLLinkElement | null
    if (!el) {
      el = document.createElement('link')
      el.rel = 'alternate'
      el.id = id
      el.setAttribute('hreflang', hreflang)
      document.head.appendChild(el)
    }
    el.href = pageUrl
  }
}

export async function setPageMeta(routeName: string, language: Language) {
  if (typeof document === 'undefined') return
  const meta = await getPageMeta(routeName)
  if (!meta) return

  const title = meta.title[language] || meta.title['zh']
  const description = meta.description[language] || meta.description['zh']
  const keywords = meta.keywords ? (meta.keywords[language] || meta.keywords['zh'] || '') : ''

  if (title) {
    document.title = title
    setMetaProperty('og:title', title)
    setMetaName('twitter:title', title)
  }

  if (description) {
    setMetaName('description', description)
    setMetaProperty('og:description', description)
    setMetaName('twitter:description', description)
  }

  if (keywords) {
    setMetaName('keywords', keywords)
  }

  // Always use favicon.png as share image
  const favicon.pngUrl = `${BASE_URL}/favicon.png`
  setMetaProperty('og:image', favicon.pngUrl)
  setMetaName('twitter:image', favicon.pngUrl)

  // OG locale for current language
  setMetaProperty('og:locale', LANG_TO_OG_LOCALE[language] || 'zh_CN')
}

export function getPageNameFromRoute(path: string): string {
  const cleanPath = path.replace(/^\/|\/$/g, '')
  if (cleanPath === '') return 'home'
  if (cleanPath === 'md') return 'docs-home'
  if (cleanPath.startsWith('md/')) return `doc-${cleanPath.replace('md/', '')}`

  const mapping: Record<string, string> = {
    'chart-ranking': 'chart-ranking',
    'user-ranking': 'user-ranking',
    'chart-download': 'chart-download',
    'phira-download': 'phira-download',
    'navigation': 'navigation',
    'announcement': 'announcement',
    'agreement': 'agreement',
    'about': 'about',
    'rooms': 'rooms',
    'account': 'account',
  }
  return mapping[cleanPath] || cleanPath
}

export async function updatePageMeta(pageName: string) {
  await updateFullPageMeta(pageName)
}

export function useRouteMeta() {
  const i18nStore = useI18nStore()
  return {
    setMetaForRoute(routeName: string) {
      setPageMeta(routeName, i18nStore.currentLanguage)
    }
  }
}

export function getPageSchema(pageName: string, language: Language): SchemaData | null {
  const baseSchema = {
    '@context': 'https://schema.org',
    '@id': `${BASE_URL}/${pageName === 'home' ? '' : pageName}`,
  }
  const name = (map: Record<Language, string>) => map[language] || map['zh']

  switch (pageName) {
    case 'home':
      return { ...baseSchema, '@type': 'WebPage', 'name': 'HSN Phira多人游戏服务器', 'url': BASE_URL,
        'isPartOf': { '@id': `${BASE_URL}/#website` }, 'about': { '@id': `${BASE_URL}/#organization` } }
    case 'about':
      return { ...baseSchema, '@type': 'AboutPage', 'url': `${BASE_URL}/about`,
        'name': name({ zh: '关于我们', 'zh-TW': '關於我們', en: 'About Us', ja: '私たちについて' }),
        'isPartOf': { '@id': `${BASE_URL}/#website` } }
    case 'phira-download':
      return { ...baseSchema, '@type': 'SoftwareApplication', 'name': 'Phira',
        'applicationCategory': 'GameApplication', 'operatingSystem': ['Android', 'Windows', 'Linux'],
        'softwareVersion': '0.6.7', 'url': `${BASE_URL}/phira-download`,
        'isPartOf': { '@id': `${BASE_URL}/#website` }, 'publisher': { '@id': `${BASE_URL}/#organization` } }
    case 'announcement':
      return { ...baseSchema, '@type': 'CollectionPage', 'url': `${BASE_URL}/announcement`,
        'name': name({ zh: '公告', 'zh-TW': '公告', en: 'Announcements', ja: 'お知らせ' }),
        'isPartOf': { '@id': `${BASE_URL}/#website` } }
    case 'docs-home':
      return { ...baseSchema, '@type': 'CollectionPage', 'url': `${BASE_URL}/md`,
        'name': name({ zh: '文档中心', 'zh-TW': '文檔中心', en: 'Documentation Center', ja: 'ドキュメントセンター' }),
        'isPartOf': { '@id': `${BASE_URL}/#website` } }
    case 'agreement':
      return { ...baseSchema, '@type': 'LegalService', 'url': `${BASE_URL}/agreement`,
        'name': name({ zh: '用户协议', 'zh-TW': '用戶協議', en: 'User Agreement', ja: '利用規約' }),
        'isPartOf': { '@id': `${BASE_URL}/#website` } }
    default:
      return { ...baseSchema, '@type': 'WebPage', 'name': pageName,
        'url': `${BASE_URL}/${pageName}`, 'isPartOf': { '@id': `${BASE_URL}/#website` } }
  }
}

export function updatePageSchema(pageName: string, language: Language) {
  if (typeof document === 'undefined') return
  const schema = getPageSchema(pageName, language)
  if (!schema) return
  const el = document.getElementById('current-page-schema')
  if (el) el.textContent = JSON.stringify(schema, null, 2)
}

function updateBreadcrumbSchema(pageName: string, language: Language) {
  if (typeof document === 'undefined') return
  const name = (map: Record<Language, string>) => map[language] || map['zh']

  const pageTitles: Record<string, Record<Language, string>> = {
    'about': { zh: '关于我们', 'zh-TW': '關於我們', en: 'About Us', ja: '私たちについて' },
    'phira-download': { zh: 'Phira下载', 'zh-TW': 'Phira下載', en: 'Phira Download', ja: 'Phiraダウンロード' },
    'announcement': { zh: '公告', 'zh-TW': '公告', en: 'Announcements', ja: 'お知らせ' },
    'docs-home': { zh: '文档中心', 'zh-TW': '文檔中心', en: 'Documentation Center', ja: 'ドキュメントセンター' },
    'agreement': { zh: '用户协议', 'zh-TW': '用戶協議', en: 'User Agreement', ja: '利用規約' },
    'rooms': { zh: '房间列表', 'zh-TW': '房間列表', en: 'Room List', ja: 'ルームリスト' },
    'chart-ranking': { zh: '谱面排行', 'zh-TW': '譜面排行', en: 'Chart Ranking', ja: '譜面ランキング' },
    'user-ranking': { zh: '用户排行', 'zh-TW': '用戶排行', en: 'User Ranking', ja: 'ユーザーランキング' },
    'navigation': { zh: '导航', 'zh-TW': '導航', en: 'Navigation', ja: 'ナビゲーション' },
    'chart-download': { zh: '谱面下载', 'zh-TW': '譜面下載', en: 'Chart Download', ja: '譜面ダウンロード' },
  }

  const items: any[] = [{
    '@type': 'ListItem', 'position': 1,
    'name': name({ zh: '主页', 'zh-TW': '主頁', en: 'Home', ja: 'ホーム' }),
    'item': BASE_URL
  }]

  if (pageName !== 'home' && pageTitles[pageName]) {
    items.push({
      '@type': 'ListItem', 'position': 2,
      'name': name(pageTitles[pageName]),
      'item': `${BASE_URL}/${pageName === 'docs-home' ? 'md' : pageName}`
    })
  }

  const schema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': items }

  let el = document.getElementById('breadcrumb-schema') as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.id = 'breadcrumb-schema'
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(schema, null, 2)
}

export async function updateFullPageMeta(pageName: string) {
  if (typeof document === 'undefined') return
  const i18nStore = useI18nStore()
  const language = i18nStore.currentLanguage

  updateHtmlLang(language)
  updateCanonical(pageName)
  updateHreflang(pageName)
  await setPageMeta(pageName, language)
  updatePageSchema(pageName, language)
  updateBreadcrumbSchema(pageName, language)
}

/** Re-apply meta when only language changes (route stays same) */
export async function refreshMetaForLanguageChange(pageName: string, language: Language) {
  if (typeof document === 'undefined') return
  updateHtmlLang(language)
  await setPageMeta(pageName, language)
  updatePageSchema(pageName, language)
  updateBreadcrumbSchema(pageName, language)
}
